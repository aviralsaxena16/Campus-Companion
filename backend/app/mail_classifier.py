# from fastapi import APIRouter, HTTPException
# from pydantic import BaseModel
# from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
# import torch
# import os # We still use os, but just to check for a token

# # --- 1. Define Model ID from Hugging Face Hub ---

# # !! THIS IS THE ONLY LINE YOU NEED TO CHANGE !!
# # Replace this with your actual Hugging Face Model ID
# MODEL_ID = "aviralsaxena16/campus-mail-classifier" 

# # --- 2. Define Labels ---
# # These MUST match the order from your training
# id2label = {
#     0: "career",
#     1: "deadline",
#     2: "event",
#     3:"general",
#     4: "spam",
# }
# label2id = {label: idx for idx, label in id2label.items()}

# # --- 3. Load the Model from the Hub ---
# classifier = None

# # Optional: Check for a Hugging Face API token if your model is private
# # If your model is public, you don't need this.
# hf_token = os.environ.get("HF_TOKEN") 

# try:
#     print(f"Loading model {MODEL_ID} from Hugging Face Hub...")
#     tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, token=hf_token)
    
#     model = AutoModelForSequenceClassification.from_pretrained(
#         MODEL_ID,
#         id2label=id2label,
#         label2id=label2id,
#         token=hf_token
#     )
    
#     print("Creating text-classification pipeline...")
#     # device=-1 (CPU) is safest for your laptop
#     classifier = pipeline("text-classification", model=model, tokenizer=tokenizer, device=-1) 
    
#     print("\n✅ Fine-tuned model loaded successfully from Hub.\n")

# except Exception as e:
#     print(f"--- ERROR LOADING MODEL FROM HUB ---")
#     print(f"Could not load {MODEL_ID}. Is the ID correct?")
#     print(f"If your model is private, set an environment variable named HF_TOKEN.")
#     print(f"Error: {e}")
#     print("The /api/classify-mail endpoint will not work.")
#     print(f"---------------")


# # --- 4. Create the API Router ---
# router = APIRouter()

# # --- 5. Define Request and Response Models ---
# class MailInput(BaseModel):
#     text: str

# class MailPrediction(BaseModel):
#     label: str
#     score: float

# # --- 6. Create the API Endpoint ---
# @router.post("/classify-mail", response_model=MailPrediction)
# async def classify_mail(mail: MailInput):
#     if classifier is None:
#         raise HTTPException(status_code=503, detail="Model is not loaded. Check server logs.")
        
#     if not mail.text or mail.text.strip() == "":
#         raise HTTPException(status_code=400, detail="Input text cannot be empty")

#     try:
#         prediction = classifier(mail.text)[0]
#         return MailPrediction(
#             label=prediction['label'],
#             score=prediction['score']
#         )
#     except Exception as e:
#         print(f"Prediction error: {e}")
#         raise HTTPException(status_code=500, detail=f"Error during prediction: {str(e)}")