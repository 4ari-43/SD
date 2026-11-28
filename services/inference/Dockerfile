FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
ENV HF_HOME=/models PYTHONUNBUFFERED=1 TOKENIZERS_PARALLELISM=false
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
