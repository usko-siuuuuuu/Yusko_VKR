FROM python:3.12-slim

WORKDIR /app

# Копируем и устанавливаем зависимости отдельным слоем —
# чтобы Docker переиспользовал кэш при изменении только кода
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
