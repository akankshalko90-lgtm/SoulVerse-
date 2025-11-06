import { IncomingForm } from 'formidable';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';

// Configuration for serverless functions to handle multipart/form-data
export const config = {
  api: {
    bodyParser: false, // Disable default bodyParser as we handle multipart/form-data
  },
};

/**
 * @description A mapping for music choices to their respective file paths.
 * IMPORTANT: These files (e.g., 'ambient_background.mp3', 'orchestral_background.mp3')
 * must exist in the 'public/audio' directory of your project when deployed.
 * For a real production application, consider storing these in cloud storage
 * (e.g., Google Cloud Storage, S3) and fetching them dynamically for better scalability.
 * For local development, ensure these files are in your project's `public/audio` folder.
 */
const MUSIC_FILES = {
  'ambient': path.join(process.cwd(), 'public', 'audio', 'ambient_background.mp3'),
  'orchestral': path.join(process.cwd(), 'public', 'audio', 'orchestral_background.mp3'),
  // Add more music options here, ensuring the files exist at the specified path.
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const form = new IncomingForm();
  let voiceFilePath = '';
  let mixedFilePath = '';

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const voiceAudioFile = files.voice_audio?.[0];
    const musicChoice = fields.musicChoice?.[0];

    if (!voiceAudioFile) {
      return res.status(400).json({ error: 'Voice audio file is required for mixing.' });
    }
    if (!musicChoice || !MUSIC_FILES[musicChoice]) {
        return res.status(400).json({ error: 'The harmony awaits. Please choose a background melody to accompany your verse.' });
    }
    const musicSourceFilePath = MUSIC_FILES[musicChoice];

    // Verify music file existence
    try {
        await fs.access(musicSourceFilePath);
    } catch (error) {
        console.error(`Music file not found at ${musicSourceFilePath}:`, error);
        return res.status(500).json({ error: 'The chosen melody is lost in the mists. Background music file not found on the server.' });
    }

    // Create temporary directory and file paths
    const tempDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tempDir, { recursive: true });

    voiceFilePath = path.join(tempDir, `voice-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`);
    mixedFilePath = path.join(tempDir, `final_mix-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`);

    // Move uploaded voice file to temp path
    await fs.rename(voiceAudioFile.filepath, voiceFilePath);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(voiceFilePath)
        .input(musicSourceFilePath)
        .complexFilter([
          '[1:a]volume=0.25[music_vol]',
          '[0:a][music_vol]amix=inputs=2:duration=first:dropout_transition=2[aout]'
        ])
        .outputOptions([
          '-map [aout]',
          '-c:a libmp3lame',
          '-q:a 2'
        ])
        .save(mixedFilePath)
        .on('end', () => resolve())
        .on('error', (err) => {
          console.error('FFmpeg error:', err.message);
          reject(new Error('The blend was lost in the ether. Failed to weave voice and music into one tapestry.'));
        });
    });

    // Stream the mixed audio back to the client
    const stat = await fs.stat(mixedFilePath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', 'inline; filename="final_mix.mp3"');

    const readStream = createReadStream(mixedFilePath);
    readStream.pipe(res);

    await new Promise((resolve) => {
      readStream.on('end', async () => {
        // Ensure files are fully streamed before attempting to delete
        // A small timeout helps with potential file handle contention on some systems
        setTimeout(async () => {
          await Promise.allSettled([
            fs.unlink(voiceFilePath).catch(e => e.code !== 'ENOENT' && console.warn(`Failed to clean up voice temp file: ${e.message}`)),
            fs.unlink(mixedFilePath).catch(e => e.code !== 'ENOENT' && console.warn(`Failed to clean up mixed temp file: ${e.message}`)),
          ]);
          resolve();
        }, 100);
      });
      readStream.on('error', (err) => {
        console.error('Error streaming mixed audio:', err);
        // If an error occurs during streaming, ensure cleanup is still attempted
        resolve(); // Resolve to allow finally block to run
      });
    });

  } catch (error) {
    console.error('API mix handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'An unexpected sorrow befell the mixing. Please try again.' });
    }
  } finally {
    // Final robust cleanup attempt for any files that might still exist
    await Promise.allSettled([
      fs.unlink(voiceFilePath).catch(e => e.code !== 'ENOENT' && console.warn(`Failed to clean up voice temp file in finally: ${e.message}`)),
      fs.unlink(mixedFilePath).catch(e => e.code !== 'ENOENT' && console.warn(`Failed to clean up mixed temp file in finally: ${e.message}`)),
    ]);
  }
}