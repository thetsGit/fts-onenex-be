// Validate all required environment variables at startup

type RequiredEnvVars = {
  name: keyof Bun.Env;
  description: string;
};

const requiredVariables: RequiredEnvVars[] = [
  { name: "FTS_API_BASE_URL", description: "Onenex's FTS source base API url" },
  { name: "FTS_API_PORT", description: "Onenex's FTS source API port" },
  { name: "FTS_TCP_HOSTNAME", description: "Onenex's FTS TCP server hostname" },
];

export function validateEnvironment(): void {
  const missing: string[] = [];

  for (const variable of requiredVariables) {
    if (!Bun.env[variable.name]) {
      missing.push(`${variable.name} - ${variable.description}`);
    }
  }

  if (missing.length > 0) {
    console.error("Missing required environment variables:");
    missing.forEach((msg) => console.error(`  - ${msg}`));
    console.error(
      "\nPlease set these variables in your .env file or environment.",
    );
    process.exit(1);
  }

  console.log("All required environment variables are set.");
}
