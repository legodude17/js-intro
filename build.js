import fs from 'fs/promises';
import path from 'path';
import handlebars from 'handlebars';
import markdownit from 'markdown-it';
import blockEmbedPlugin from 'markdown-it-block-embed';
import VideoServiceBase from 'markdown-it-block-embed/lib/services/VideoServiceBase.js';
import YAML from 'yaml';

const md = markdownit({
  html: true,
  linkify: true,
  typographer: true
});
class ReplItService extends VideoServiceBase {
  getDefaultOptions() {
    return { width: '100%', height: 500 };
  }

  extractVideoID(reference) {
    let match = reference.match(/^.*replit.com\/(@.+)\/([^#]*)#?.*$/);
    return `${match[1]}/${match[2]}`;
  }

  getVideoUrl(videoID) {
    return `//replit.com/${videoID}?embed=true`;
  }
}
md.use(blockEmbedPlugin, {
  allowFullScreen: false,
  services: {
    replit: ReplItService
  }
});
const distPath = path.resolve('./dist');
const lessonBasePath = path.resolve('./lessonBase.html');
const lessonsPath = path.resolve('./lessons');
const indexPathIn = path.resolve('./index.html');
const indexPathOut = path.join(distPath, 'index.html');
const configRE = /^---\n([\s\S]*)\n---/;

async function run() {
  await fs.mkdir(distPath, {recursive: true});
  const lessonTemplate = handlebars.compile(await fs.readFile(lessonBasePath, 'utf-8'), {noEscape: true});
  const lessons = await Promise.all((await fs.readdir(lessonsPath)).map(async lesson => {
    const lessonPath = path.join(lessonsPath, lesson);
    const resultFileName = path.basename(lesson, '.md') + '.html';
    const resultPath = path.join(distPath, resultFileName);
    const markdown = await fs.readFile(lessonPath, 'utf-8');
    const match = markdown.match(configRE);
    const data = match ? YAML.parse(match[1]) : {};
    const content = md.render(markdown.replace(configRE, ''));
    const result = lessonTemplate({content});
    await fs.writeFile(resultPath, result);
    data.url = resultFileName;
    return data;
  }));
  const indexTemplate = handlebars.compile(await fs.readFile(indexPathIn, 'utf-8'));
  await fs.writeFile(indexPathOut, indexTemplate({lessons}));
}

run();
