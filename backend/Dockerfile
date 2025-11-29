FROM python:3.11-slim

# 2. Set environment variables to prevent Python from writing .pyc files
# and to flush logs to the terminal immediately
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. Set the working directory inside the container
WORKDIR /app

# 4. Copy requirements first (for better caching)
COPY requirements.txt .

# 5. Install dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 6. Copy the rest of the application code
COPY . .



# 7. Expose the port the app runs on
EXPOSE 8000

# 8. The command to start the app (using your robust run.py)
# We use --prod to ensure it binds to 0.0.0.0
CMD ["python", "run.py", "--prod"]