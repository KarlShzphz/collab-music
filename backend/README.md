# Collab Music Backend

Backend сервер для collaborative music platform.

## Установка

```bash
cd backend
npm install
```

## Запуск

### Режим разработки
```bash
npm run dev
```

### Продакшн
```bash
npm start
```

Сервер запустится на порту 3001.

## API Endpoints

### GET /api/recordings
Получить список всех записей

### POST /api/recordings
Загрузить новую запись
- `audio` (file) - аудио файл
- `title` (string) - название записи
- `description` (string) - описание
- `author` (string) - автор
- `bpm` (number) - темп

### GET /api/recordings/:id
Получить конкретную запись по ID

### DELETE /api/recordings/:id
Удалить запись

## Структура данных

```json
{
  "id": "string",
  "title": "string",
  "description": "string", 
  "author": "string",
  "bpm": "number",
  "filename": "string",
  "originalName": "string",
  "size": "number",
  "mimetype": "string",
  "uploadDate": "string",
  "url": "string"
}
```

## Папки

- `uploads/` - сохраненные аудио файлы
- `server.js` - основной файл сервера
- `package.json` - зависимости
