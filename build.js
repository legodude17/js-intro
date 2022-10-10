import fs from 'fs/promises';
import path from 'path';
import handlebars from 'handlebars';
import markdownit from 'markdown-it';
import blockEmbedPlugin from 'markdown-it-block-embed';
import VideoServiceBase from 'markdown-it-block-embed/lib/services/VideoServiceBase.js';
import YAML from 'yaml';
import resolveCb from "resolve";
import ll from 'listr-log';
import {promisify} from 'util';
import {createStarryNight, common} from '@wooorm/starry-night';
import {toHtml} from 'hast-util-to-html';

const starryNight = await createStarryNight(common)

const resolve = promisify(resolveCb);
const md = markdownit({
  html: true,
  linkify: true,
  typographer: true,
  highlight(value, lang) {
    const scope = starryNight.flagToScope(lang)

    return toHtml({
      type: 'element',
      tagName: 'pre',
      properties: {
        className: scope
          ? [
              'highlight',
              'highlight-' + scope.replace(/^source\./, '').replace(/\./g, '-')
            ]
          : undefined
      },
      children: scope
        ? starryNight.highlight(value, scope).children
        : [{type: 'text', value}]
    })
  }
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
const lessonBasePath = path.resolve('./site/lessonBase.html');
const lessonsPath = path.resolve('./lessons');
const indexPathIn = path.resolve('./site/index.html');
const indexPathOut = path.join(distPath, 'index.html');
const configRE = /^---\n([\s\S]*)\n---/;
async function copy() {
  return [
    path.resolve('./site/main.css'),
    await resolve('github-markdown-css/github-markdown.css')
  ];
}

async function run() {
  ll.lessons = 'Lessons';
  ll.start();
  const lessonTemplate = handlebars.compile(await fs.readFile(lessonBasePath, 'utf-8'), {noEscape: true});
  const lessons = await Promise.all((await fs.readdir(lessonsPath)).map(async lesson => {
    const lessonPath = path.join(lessonsPath, lesson);
    const lessonName = path.basename(lesson, '.md');
    ll.lessons.addTask({name: lessonName, title: `Lesson ${lessonName}`});
    const resultFileName = lessonName + '.html';
    const resultPath = path.join(distPath, resultFileName);
    const markdown = await fs.readFile(lessonPath, 'utf-8');
    const match = markdown.match(configRE);
    const data = match ? YAML.parse(match[1]) : {};
    data.content = md.render(markdown.replace(configRE, ''));
    data.path = resultPath;
    data.url = resultFileName;
    data.index = parseInt(lessonName, 10);
    return data;
  }));
  lessons.sort((a, b) => a.index - b.index);
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    lesson.prev = lessons[i - 1];
    lesson.next = lessons[i + 1];
  }
  await Promise.all(lessons.map(async lesson => {
    await fs.writeFile(lesson.path, lessonTemplate(lesson));
    ll.lessons[lesson.index].complete(`${lesson.index + '.md'} -> dist/${lesson.index + '.html'}`);
  }));
  ll.index = 'index.html';
  const indexTemplate = handlebars.compile(await fs.readFile(indexPathIn, 'utf-8'));
  await fs.writeFile(indexPathOut, indexTemplate({lessons}));
  ll.index.complete('Wrote dist/index.html');
  ll.copy = 'Copy Files';
  await Promise.all((await copy())
    .map(filePath => {
      const fileName = path.basename(filePath);
      ll.copy.addTask({name: filePath, title: fileName});
      fs.readFile(filePath)
        .then(contents => fs.writeFile(path.join(distPath, fileName), contents))
        .then(() => ll.copy[filePath].complete(`Wrote dist/${fileName}`));
    }));
  await new Promise((res) => setTimeout(res, 100));
  ll.end();
}

run();
