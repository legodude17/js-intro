import fs from "fs/promises";
import path from "path";
import handlebars from "handlebars";
import resolveCb from "resolve";
import { promisify } from "util";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkToc from "remark-toc";
import rehypeSlug from "rehype-slug";
import rehypeAutolink from "rehype-autolink-headings";
import rehypeStarryNight from "./rehype-starry-night.js";
import remarkYamlEmit from "./remark-yaml-emit.js";
import EventEmitter from "events";
import remarkEmbedder from "@remark-embedder/core";
import oembedTransformer from "@remark-embedder/transformer-oembed";
import { read } from "to-vfile";
import { h, s } from "hastscript";

const resolve = promisify(resolveCb);

const ee = new EventEmitter();

const md = unified()
  .use(remarkParse)
  .use(remarkEmbedder.default, {
    transformers: [oembedTransformer.default],
  })
  .use(remarkGfm)
  .use(remarkFrontmatter, "yaml")
  .use(remarkYamlEmit, ee)
  .use(remarkToc)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeAutolink, {
    content(node) {
      return h("span.icon.icon-link.anchor", { ariaHidden: "true" }, [
        h(
          "svg.octicon.octicon-link",
          {
            ariaHidden: "true",
            xmlns: "http://www.w3.org/2000/svg",
            viewbox: "0 0 16 16",
            width: 16,
            height: 16,
          },
          [
            s("path", {
              fillRule: "evenodd",
              d: "M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z",
            }),
          ]
        ),
      ]);
    },
  })
  .use(rehypeStarryNight)
  .use(rehypeStringify)
  .freeze();

const distPath = path.resolve("./dist");
const lessonBasePath = path.resolve("./site/lessonBase.html");
const lessonsPath = path.resolve("./lessons");
const indexPathIn = path.resolve("./site/index.html");
const indexPathOut = path.join(distPath, "index.html");
async function copy() {
  return [
    path.resolve("./site/main.css"),
    await resolve("github-markdown-css/github-markdown.css"),
  ];
}

async function run() {
  const lessonTemplate = handlebars.compile(
    await fs.readFile(lessonBasePath, "utf-8"),
    { noEscape: true }
  );
  const additionalData = {};
  ee.on("data", (file, data) => (additionalData[file] = data));
  const lessons = await Promise.all(
    (
      await fs.readdir(lessonsPath)
    ).map(async (lesson) => {
      const data = {};
      const lessonPath = path.join(lessonsPath, lesson);
      const lessonName = path.basename(lesson, ".md");
      data.file = lesson;
      data.index = parseInt(lessonName, 10);
      data.url = lessonName + ".html";
      data.path = path.join(distPath, data.url);
      data.content = (await md.process(await read(lessonPath))).toString();
      return data;
    })
  );
  lessons.sort((a, b) => a.index - b.index);
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    lesson.prev = lessons[i - 1];
    lesson.next = lessons[i + 1];
    lessons[i] = { ...lesson, ...additionalData[lesson.file] };
  }
  await Promise.all(
    lessons.map(async (lesson) => {
      await fs.writeFile(lesson.path, lessonTemplate(lesson));
      console.error(
        `lessons/${lesson.index + ".md"} -> dist/${lesson.index + ".html"}`
      );
    })
  );
  const indexTemplate = handlebars.compile(
    await fs.readFile(indexPathIn, "utf-8")
  );
  await fs.writeFile(indexPathOut, indexTemplate({ lessons }));
  console.error("site/index.html -> dist/index.html");
  await Promise.all(
    (
      await copy()
    ).map((filePath) => {
      const fileName = path.basename(filePath);
      fs.readFile(filePath)
        .then((contents) =>
          fs.writeFile(path.join(distPath, fileName), contents)
        )
        .then(() =>
          console.error(
            `${path.basename(
              path.dirname(filePath)
            )}/${fileName} -> dist/${fileName}`
          )
        );
    })
  );
}

run();
