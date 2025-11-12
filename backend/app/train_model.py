import pandas as pd
import torch
import numpy as np
from datasets import Dataset, DatasetDict
from transformers import AutoTokenizer, AutoModelForSequenceClassification, TrainingArguments, Trainer
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score
from huggingface_hub import HfApi, HfFolder
import os # Import os

# --- 1. CONFIGURATION ---
INPUT_CSV = "mail_dataset.csv"
MODEL_NAME = "distilbert-base-uncased" # The model we are fine-tuning
NEW_MODEL_NAME = "campus-mail-classifier" # The name for your new, saved model
HF_USERNAME = "aviralsaxena16" # REPLACE THIS WITH YOUR HUGGING FACE USERNAME

# Our 5 labels
LABELS = ["DEADLINE", "CAREER", "EVENT", "SPAM/PROMO", "GENERAL"]
id2label = {i: label for i, label in enumerate(LABELS)}
label2id = {label: i for i, label in enumerate(LABELS)}

# --- 2. LOAD AND PREPARE DATASET (FIXED) ---
print(f"Loading dataset from {INPUT_CSV}...")
df = pd.read_csv(INPUT_CSV)

# Keep only the columns we need *before* any processing
df = df[['text', 'label']]

# Convert string labels to integer IDs, overwriting the old column
df['label'] = df['label'].map(label2id)

# Now drop any rows where the label was invalid (not in label2id) or text was missing
df = df.dropna(subset=['text', 'label'])

# Convert label column to integer, as .map() might leave it as float
df['label'] = df['label'].astype(int)

print(f"Loaded {len(df)} cleaned and labeled emails.")
print("Dataset columns check:", df.columns.tolist()) # This will now correctly be ['text', 'label']
# --- END OF FIX ---

# Split the dataset into training and testing (90% train, 10% test)
train_df, test_df = train_test_split(df, test_size=0.1, random_state=42, stratify=df['label'])

# Convert pandas DataFrames to Hugging Face Dataset objects
train_dataset = Dataset.from_pandas(train_df)
test_dataset = Dataset.from_pandas(test_df)

ds = DatasetDict({
    'train': train_dataset,
    'test': test_dataset
})

print("Dataset split and converted:")
print(ds)

# --- 3. TOKENIZATION ---
print(f"Loading tokenizer for {MODEL_NAME}...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

def tokenize_function(examples):
    # This function will be applied to the entire dataset
    return tokenizer(examples["text"], padding="max_length", truncation=True, max_length=512)

print("Tokenizing dataset (this may take a moment)...")
tokenized_ds = ds.map(tokenize_function, batched=True)

# Remove the original text column, the model only needs 'input_ids', 'attention_mask', and 'label'
tokenized_ds = tokenized_ds.remove_columns(["text"])
tokenized_ds.set_format("torch")

print("Tokenization complete.")

# --- 4. MODEL LOADING ---
print(f"Loading {MODEL_NAME} for fine-tuning...")
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME, 
    num_labels=len(LABELS),
    id2label=id2label,
    label2id=label2id
)

# --- 5. METRICS (The "FAANG-Level" Part) ---
def compute_metrics(eval_pred):
    """Calculates accuracy and F1 score for evaluation."""
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    
    acc = accuracy_score(labels, predictions)
    f1 = f1_score(labels, predictions, average='weighted')
    
    return {
        'accuracy': acc,
        'f1': f1,
    }

# --- 6. TRAINING ---
print("Setting up training...")
print("Setting up training...")
training_args = TrainingArguments(
    output_dir=NEW_MODEL_NAME,           # Directory to save the model
    num_train_epochs=3,                  # 3 epochs is a good starting point
    per_device_train_batch_size=16,      # Batch size
    per_device_eval_batch_size=16,       # Batch size for evaluation
    warmup_steps=50,                     # Number of steps to warm up the learning rate
    weight_decay=0.01,                   # Strength of weight decay
    logging_dir='./logs',                # Directory for logs
    logging_steps=10,
    
    # --- THIS IS THE FIX ---
    eval_strategy="epoch",         # Renamed from 'evaluation_strategy'
    # ---
    
    save_strategy="epoch",               # Save the model at the end of each epoch
    load_best_model_at_end=True,         # Load the best model at the end of training
)
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_ds["train"],
    eval_dataset=tokenized_ds["test"],
    compute_metrics=compute_metrics,     # Pass our metrics function
)

print("--- Starting Fine-Tuning ---")
trainer.train()
print("--- Fine-Tuning Complete ---")

# --- 7. SAVE AND UPLOAD MODEL ---
print(f"Saving model to {NEW_MODEL_NAME}...")
trainer.save_model(NEW_MODEL_NAME)
tokenizer.save_pretrained(NEW_MODEL_NAME)

print("Model saved locally.")

try:
    print("Logging into Hugging Face Hub...")
    # This will use your stored token (or prompt you to login)
    hf_token = os.getenv("HF_API_KEY")
    if not hf_token:
        print("HF_API_KEY not found in .env. Skipping model upload.")
    else:
        HfFolder.save_token(hf_token)
        
        api = HfApi()
        repo_id = f"{HF_USERNAME}/{NEW_MODEL_NAME}"
        
        print(f"Uploading model to {repo_id}...")
        api.create_repo(repo_id=repo_id, private=True, exist_ok=True)
        api.upload_folder(
            folder_path=NEW_MODEL_NAME,
            repo_id=repo_id,
            repo_type="model"
        )
        print("--- Model Upload Successful! ---")
        print(f"Your model is now hosted at: https://huggingface.co/{repo_id}")
    
except Exception as e:
    print(f"Could not upload model to Hugging Face Hub. Error: {e}")
    print("You can upload it manually later by dragging the './campus-mail-classifier' folder to a new private model on HF.")