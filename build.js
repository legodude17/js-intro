import fs from 'fs/promises';
import path from 'path';
import handlebars from 'handlebars';
import markdownit from 'markdown-it';
const md = markdownit({
  html: true,
  linkify: true,
  typographer: true
});
const distPath = path.resolve('./dist');
const basePath = path.resolve('./base.html');
const lessonsPath = path.resolve('./lessons');

async function run() {
  try {
    await fs.access(distPath);
  } catch (e) {
    await fs.mkdir(distPath);
  }
  const base = await fs.readFile(basePath, 'utf-8');
  await Promise.all((await fs.readdir(lessonsPath)).map(async lesson => {
    const lessonPath = path.join(lessonsPath, lesson);
    const resultPath = path.join(distPath, path.basename(lesson) + '.html');
    const content = md.render(await fs.readFile(lessonPath, 'utf-8'));
    const template = handlebars.compile(base);
    const result = template({content});
    await fs.writeFile(resultPath, result);
  }))
}

run();
