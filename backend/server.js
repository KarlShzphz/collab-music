const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// Создаем папку для загрузок если её нет
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Настройка multer для загрузки аудио файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `recording-${uniqueSuffix}${extension}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB лимит
  },
  fileFilter: (req, file, cb) => {
    // Проверяем что это аудио файл
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Только аудио файлы разрешены!'), false);
    }
  }
});

// Хранилище для метаданных записей
let recordings = [];

// API для получения списка записей
app.get('/api/recordings', (req, res) => {
  res.json(recordings);
});

// API для загрузки записи
app.post('/api/recordings', upload.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудио файл не найден' });
    }

    const { title, description, bpm, author } = req.body;
    
    const recording = {
      id: Date.now().toString(),
      title: title || 'Без названия',
      description: description || '',
      author: author || 'Аноним',
      bpm: parseInt(bpm) || 120,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadDate: new Date().toISOString(),
      url: `/uploads/${req.file.filename}`
    };

    recordings.push(recording);
    
    console.log('🎵 Новая запись сохранена:', recording);
    
    res.json({
      success: true,
      recording: recording
    });
  } catch (error) {
    console.error('Ошибка при сохранении записи:', error);
    res.status(500).json({ error: 'Ошибка сервера при сохранении записи' });
  }
});

// API для получения конкретной записи
app.get('/api/recordings/:id', (req, res) => {
  const recording = recordings.find(r => r.id === req.params.id);
  if (!recording) {
    return res.status(404).json({ error: 'Запись не найдена' });
  }
  res.json(recording);
});

// API для удаления записи
app.delete('/api/recordings/:id', (req, res) => {
  const recordingIndex = recordings.findIndex(r => r.id === req.params.id);
  if (recordingIndex === -1) {
    return res.status(404).json({ error: 'Запись не найдена' });
  }

  const recording = recordings[recordingIndex];
  
  // Удаляем файл с диска
  const filePath = path.join(uploadsDir, recording.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Удаляем из массива
  recordings.splice(recordingIndex, 1);
  
  res.json({ success: true, message: 'Запись удалена' });
});

// Обработка ошибок multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Файл слишком большой (максимум 50MB)' });
    }
  }
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📁 Загрузки сохраняются в: ${uploadsDir}`);
});
