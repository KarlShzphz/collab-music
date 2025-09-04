const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3003;

// Создаем папку для загрузок если её нет
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Хранилище для метаданных записей
let recordings = [];

// MIME типы
const mimeTypes = {
  '.mp3': 'audio/mpeg',
  '.mp4': 'audio/mp4',
  '.webm': 'audio/webm',
  '.wav': 'audio/wav',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API endpoints
  if (pathname === '/api/recordings' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(recordings));
    return;
  }

  if (pathname === '/api/recordings' && method === 'POST') {
    console.log('📥 Получен POST запрос на /api/recordings');
    let body = Buffer.alloc(0); // ← ЗАМЕНЯЮ
    req.on('data', chunk => {
      body = Buffer.concat([body, chunk]); // ← ЗАМЕНЯЮ
    });

    req.on('end', () => {
      try {
        // Простая обработка multipart/form-data
        const boundary = req.headers['content-type'].split('boundary=')[1];
        const boundaryBuffer = Buffer.from('--' + boundary); // ← ЗАМЕНЯЮ
        
        // Ищем границы в Buffer
        const parts = [];
        let start = 0;
        let pos = 0;
        
        while ((pos = body.indexOf(boundaryBuffer, start)) !== -1) {
          if (start > 0) {
            parts.push(body.slice(start, pos));
          }
          start = pos + boundaryBuffer.length;
        }
        
        let audioData = null;
        let metadata = {};
        
        for (const part of parts) {
          const partStr = part.toString('utf8');
          if (partStr.includes('name="audio"')) {
            const audioStart = part.indexOf(Buffer.from('\r\n\r\n')) + 4;
            const audioEnd = part.lastIndexOf(Buffer.from('\r\n'));
            // Извлекаем бинарные данные как Buffer
            audioData = part.slice(audioStart, audioEnd); // ← ЗАМЕНЯЮ
          } else if (partStr.includes('name="title"')) {
            const start = part.indexOf(Buffer.from('\r\n\r\n')) + 4;
            const end = part.lastIndexOf(Buffer.from('\r\n'));
            metadata.title = part.slice(start, end).toString('utf8');
          } else if (partStr.includes('name="author"')) {
            const start = part.indexOf(Buffer.from('\r\n\r\n')) + 4;
            const end = part.lastIndexOf(Buffer.from('\r\n'));
            metadata.author = part.slice(start, end).toString('utf8');
          } else if (partStr.includes('name="description"')) {
            const start = part.indexOf(Buffer.from('\r\n\r\n')) + 4;
            const end = part.lastIndexOf(Buffer.from('\r\n'));
            metadata.description = part.slice(start, end).toString('utf8');
          } else if (partStr.includes('name="bpm"')) {
            const start = part.indexOf(Buffer.from('\r\n\r\n')) + 4;
            const end = part.lastIndexOf(Buffer.from('\r\n'));
            metadata.bpm = parseInt(part.slice(start, end).toString('utf8')) || 120;
          }
        }

        if (!audioData) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Аудио файл не найден' }));
          return;
        }

        // Определяем расширение файла на основе заголовков
        let extension = '.mp4'; // По умолчанию MP4
        let mimetype = 'audio/mp4';
        
        // Определяем формат на основе реального содержимого файла
        console.log('🔍 Анализируем multipart data...');
        
        // Проверяем первые байты аудио данных для определения формата
        let detectedFormat = '.mp4'; // По умолчанию MP4
        let detectedMimeType = 'audio/mp4';
        
        if (audioData && audioData.length > 4) {
          const header = audioData.subarray(0, 20);
          console.log('📄 Заголовок аудио данных:', Array.from(header).join(' '));
          
          // Проверяем магические числа для определения типа файла
          const headerStr = header.toString('ascii');
          if (headerStr.includes('ftypmp4') || headerStr.includes('ftypisom') || headerStr.includes('ftypM4A')) {
            detectedFormat = '.mp4';
            detectedMimeType = 'audio/mp4';
            console.log('✅ Обнаружен MP4 формат по заголовку');
          } else if (headerStr.includes('webm') || headerStr.includes('matroska')) {
            detectedFormat = '.webm';
            detectedMimeType = 'audio/webm';
            console.log('✅ Обнаружен WebM формат по заголовку');
          } else if (headerStr.includes('RIFF') && headerStr.includes('WAVE')) {
            detectedFormat = '.wav';
            detectedMimeType = 'audio/wav';
            console.log('✅ Обнаружен WAV формат по заголовку');
          } else {
            console.log('🤔 Формат не определен, используем MP4 по умолчанию');
          }
        }
        
        extension = detectedFormat;
        mimetype = detectedMimeType;
        
        // Сохраняем файл
        const filename = `recording-${Date.now()}-${Math.round(Math.random() * 1E9)}${extension}`;
        const filepath = path.join(uploadsDir, filename);
        
        console.log('🔍 Сохраняем файл:', {
          filename: filename,
          audioDataLength: audioData.length,
          audioDataType: typeof audioData
        });
        
        fs.writeFileSync(filepath, audioData);

        const recording = {
          id: Date.now().toString(),
          title: metadata.title || 'Без названия',
          description: metadata.description || '',
          author: metadata.author || 'Аноним',
          bpm: metadata.bpm || 120,
          filename: filename,
          originalName: `recording${extension}`,
          size: audioData.length,
          mimetype: mimetype,
          uploadDate: new Date().toISOString(),
          url: `/uploads/${filename}`
        };

        recordings.push(recording);
        
        console.log('🎵 Новая запись сохранена:', recording);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          recording: recording
        }));

      } catch (error) {
        console.error('Ошибка при сохранении записи:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ошибка сервера при сохранении записи' }));
      }
    });
    return;
  }

  // Статические файлы
  if (pathname.startsWith('/uploads/')) {
    const filename = pathname.replace('/uploads/', '');
    const filepath = path.join(uploadsDir, filename);
    
    if (fs.existsSync(filepath)) {
      const ext = path.extname(filename);
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      
      // Добавляем CORS заголовки для аудио файлов
      res.writeHead(200, { 
        'Content-Type': mimeType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600'
      });
      fs.createReadStream(filepath).pipe(res);
      return;
    }
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`🚀 Простой сервер запущен на порту ${PORT}`);
  console.log(`📁 Загрузки сохраняются в: ${uploadsDir}`);
});
