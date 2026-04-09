const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates');

// Simple template engine: replaces {{VAR_NAME}} with values from context
function render(templateName, context) {
  const templatePath = path.join(TEMPLATES_DIR, templateName);
  let content = fs.readFileSync(templatePath, 'utf-8');

  for (const [key, value] of Object.entries(context)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    content = content.replace(pattern, String(value ?? ''));
  }

  return content;
}

// Render and write to a temp file, return the path
function renderToFile(templateName, context, outputDir) {
  const content = render(templateName, context);
  const outputPath = path.join(outputDir || require('os').tmpdir(), templateName);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, { mode: 0o755 });
  return outputPath;
}

module.exports = { render, renderToFile };
