const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');

const PORT = 3001;

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
  '.webm': 'audio/webm',
  '.mp4': 'audio/mp4',
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
    let body = Buffer.alloc(0);
    
    req.on('data', chunk => {
      body = Buffer.concat([body, chunk]);
    });

    req.on('end', () => {
      try {
        // Простая обработка multipart/form-data
        const boundary = req.headers['content-type'].split('boundary=')[1];
        const boundaryBuffer = Buffer.from(`--${boundary}`);
        const parts = [];
        let start = 0;
        
        while (true) {
          const boundaryIndex = body.indexOf(boundaryBuffer, start);
          if (boundaryIndex === -1) break;
          
          if (start > 0) {
            parts.push(body.slice(start, boundaryIndex));
          }
          start = boundaryIndex + boundaryBuffer.length;
        }
        
        let audioData = null;
        let metadata = {};
        
        for (const part of parts) {
          const partStr = part.toString();
          
          if (partStr.includes('name="audio"')) {
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
              audioData = part.slice(headerEnd + 4, -2);
            }
          } else if (partStr.includes('name="title"')) {
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
              metadata.title = part.slice(headerEnd + 4, -2).toString();
            }
          } else if (partStr.includes('name="author"')) {
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
              metadata.author = part.slice(headerEnd + 4, -2).toString();
            }
          } else if (partStr.includes('name="description"')) {
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
              metadata.description = part.slice(headerEnd + 4, -2).toString();
            }
          } else if (partStr.includes('name="bpm"')) {
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
              metadata.bpm = parseInt(part.slice(headerEnd + 4, -2).toString()) || 120;
            }
          }
        }

        if (!audioData) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Аудио файл не найден' }));
          return;
        }

        // Сохраняем исходный WebM файл
        const webmFilename = `recording-${Date.now()}-${Math.round(Math.random() * 1E9)}.webm`;
        const webmFilepath = path.join(uploadsDir, webmFilename);
        fs.writeFileSync(webmFilepath, audioData);

        // Конвертируем в MP3 с помощью FFmpeg
        const mp3Filename = webmFilename.replace('.webm', '.mp3');
        const mp3Filepath = path.join(uploadsDir, mp3Filename);
        
        console.log('🔄 Конвертируем WebM в MP3 с помощью FFmpeg...');
        
        const ffmpegCommand = `ffmpeg -i "${webmFilepath}" -acodec mp3 -ab 128k "${mp3Filepath}"`;
        
        exec(ffmpegCommand, (error, stdout, stderr) => {
          if (error) {
            console.error('❌ Ошибка FFmpeg:', error);
            // Если FFmpeg не установлен, используем исходный файл
            const recording = {
              id: Date.now().toString(),
              title: metadata.title || 'Без названия',
              description: metadata.description || '',
              author: metadata.author || 'Аноним',
              bpm: metadata.bpm || 120,
              filename: webmFilename,
              originalName: 'recording.webm',
              size: audioData.length,
              mimetype: 'audio/webm',
              uploadDate: new Date().toISOString(),
              url: `/uploads/${webmFilename}`
            };
            
            recordings.push(recording);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              recording: recording,
              warning: 'FFmpeg не установлен, сохранен WebM файл'
            }));
            return;
          }
          
          // Удаляем исходный WebM файл
          fs.unlinkSync(webmFilepath);
          
          const recording = {
            id: Date.now().toString(),
            title: metadata.title || 'Без названия',
            description: metadata.description || '',
            author: metadata.author || 'Аноним',
            bpm: metadata.bpm || 120,
            filename: mp3Filename,
            originalName: 'recording.mp3',
            size: fs.statSync(mp3Filepath).size,
            mimetype: 'audio/mpeg',
            uploadDate: new Date().toISOString(),
            url: `/uploads/${mp3Filename}`
          };
          
          recordings.push(recording);
          
          console.log('✅ Конвертация завершена:', recording);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            recording: recording
          }));
        });

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
      
      res.writeHead(200, { 'Content-Type': mimeType });
      fs.createReadStream(filepath).pipe(res);
      return;
    }
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`🚀 FFmpeg сервер запущен на порту ${PORT}`);
  console.log(`📁 Загрузки сохраняются в: ${uploadsDir}`);
  console.log(`🔧 Для конвертации в MP3 требуется FFmpeg`);
});
