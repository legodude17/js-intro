import fs from 'fs/promises';
import path from 'path';
const distPath = path.resolve('./dist');
fs.access(distPath).catch(() => fs.mkdir(distPath)).then(() => console.log('Built!'););
