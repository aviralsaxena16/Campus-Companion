# In backend/app/agent/tools/rag_tool.py
import os
from typing import Type
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader

# --- CHANGE #1: Import HuggingFace's embedding model ---
from langchain_huggingface import HuggingFaceEmbeddings

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

# The LLM for answering the question (this stays the same)
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"), temperature=0)

class DocumentQueryInput(BaseModel):
    file_path: str = Field(description="The local server path to the PDF document.")
    query: str = Field(description="The question to ask about the document.")

class DocumentQueryTool(BaseTool):
    name: str = "document_query_tool"
    description: str = "Use this tool to answer questions about a specific PDF document that the user has uploaded. You must provide the file_path and a query."
    args_schema: Type[DocumentQueryInput] = DocumentQueryInput

    async def _arun(self, file_path: str, query: str):
        try:
            if not os.path.exists(file_path):
                return f"Error: The file at path {file_path} was not found."

            loader = PyPDFLoader(file_path)
            docs = loader.load()
            if not docs: return "Error: Could not load any content from the PDF."

            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            split_docs = text_splitter.split_documents(docs)

            # --- CHANGE #2: Use the local HuggingFace embedding model ---
            # This model is small, fast, and runs entirely on your CPU.
            embeddings = HuggingFaceEmbeddings(
                model_name="all-MiniLM-L6-v2"
            )
            
            vector_store = FAISS.from_documents(split_docs, embeddings)
            retriever = vector_store.as_retriever()

            prompt = ChatPromptTemplate.from_template(
                "Answer the user's question based only on the following context:\n\n<context>{context}</context>\n\nQuestion: {input}"
            )
            
            document_chain = create_stuff_documents_chain(llm, prompt)
            retrieval_chain = create_retrieval_chain(retriever, document_chain)
            
            response = await retrieval_chain.ainvoke({"input": query})
            return response.get("answer", "I couldn't find an answer in the document.")
        except Exception as e:
            return f"An unexpected error occurred: {e}"
            
    def _run(self, file_path: str, query: str):
        raise NotImplementedError("This tool is async only.")