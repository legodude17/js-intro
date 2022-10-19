/**
 * @typedef {import('mdast').Root} Root
 * @typedef {import('mdast').YAML} YAML
 * @typedef {import('mdast-util-to-markdown').Options} Extension
 */

import YAML from "yaml";

/**
 * @type {import('unified').Plugin<import('events')[], Root>}
 */
export default function remarkYamlEmit(ee) {
  return (tree, file) => {
    if (tree.type !== "root") return;
    const node = tree.children[0];
    if (node.type !== "yaml") return;
    const data = YAML.parse(node.value);
    ee.emit("data", file.basename, data);
  };
}
