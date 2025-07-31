import type { PackageRuleItem } from "vibe-rules";
import dedent from "dedent";

function codeblock(lang: string, code: string) {
  return dedent`
  \`\`\`${lang}
  ${code}
  \`\`\`
  `;
}

const rules: PackageRuleItem[] = [
  {
    name: "architecture",
    description: "Architecture",
    rule: dedent`
    
    Use npm for package management.

    Do not run the dev server with wrangler. Use vite dev.

    We use the vite cloudflare plugin which means that we don't need to set up proxies or use a different port for API calls.
    You can just call the worker directly from the browser using fetch and it will hit src/worker.ts

    When writing typescript functions and methods, do not use primitive types like string, number, boolean, etc. as parameters, those can easily get mixed up in refactoring.
    Use type parameters with object destructuring and named properties instead.
    Do create separate params for distinct inputs.

    For example, use objects with named properties like this:

    ${codeblock("typescript", `
    function myFunction(userParams: { name: string, age: number }, appParams: { permissions: string[] }) {
      const { name, age } = userParams;
      const { permissions } = appParams;
      // ... do stuff ...
    }
    `)}
    
    This makes it clear what the parameter is and makes it safer to refactor and avoids confusion.

    For optional parameters do not use ? use union with null instead.
    To set default values declare a defaults object and use object destructuring to set the default values.
    For example, demonstrating optionals and defaults:

    ${codeblock("typescript", `
    function myFunction(userParams: { name: string, age: number | null }, appParams: { permissions: string[] | null }) {
      const { name, age = 20 } = userParams;
      const { permissions = [] } = appParams;
      // ... do stuff ...
    }
    `)}
    `,
    alwaysApply: true,
  },
];

export default rules;
