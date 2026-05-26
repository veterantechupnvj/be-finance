import app from "../app";

async function generate() {
  console.log("Generating OpenAPI spec...");
  try {
    const spec = app.getOpenAPIDocument({
      openapi: "3.0.0",
      info: {
        title: "VeteranTech Finance Dashboard API",
        version: "1.0.0",
      },
    });

    const outputPath = new URL("../../openapi.json", import.meta.url);
    await Bun.write(outputPath, JSON.stringify(spec, null, 2));
    console.log(`✅ OpenAPI spec written to ${outputPath.pathname}`);
  } catch (e: unknown) {
    console.error("❌ Failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

generate();
