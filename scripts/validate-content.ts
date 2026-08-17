import { ContentValidationError, validateContent } from "../src/content/index";

function main(): void {
  const args = new Set(process.argv.slice(2));
  const result = validateContent({
    validateLocalLinks: !args.has("--no-links"),
    includeEmptyModules: args.has("--include-empty-modules"),
  });

  if (!result.ok || !result.index) {
    console.error(`Content validation failed (${result.errors.length} error${result.errors.length === 1 ? "" : "s"}).`);
    for (const error of result.errors) {
      console.error(`- ${error.path}: ${error.field}: ${error.message}`);
    }
    if (result.warnings.length > 0) {
      console.error(`Warnings (${result.warnings.length}):`);
      for (const warning of result.warnings) {
        console.error(`- ${warning.path}: ${warning.field}: ${warning.message}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  const { index } = result;
  const lessonSummary = index.modules
    .map((module) => `${module.id} (${module.lessons.length})`)
    .join(", ");
  console.log(`Content validation passed: ${result.lessonCount} lessons in ${result.moduleCount} modules.`);
  console.log(`Modules: ${lessonSummary}`);
  console.log(`Index order: ${index.lessons.map((lesson) => lesson.id).join(" → ")}`);
  if (result.warnings.length > 0) {
    console.warn(`Warnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      console.warn(`- ${warning.path}: ${warning.field}: ${warning.message}`);
    }
  }
}

try {
  main();
} catch (error) {
  if (error instanceof ContentValidationError) {
    console.error(error.message);
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 1;
}
