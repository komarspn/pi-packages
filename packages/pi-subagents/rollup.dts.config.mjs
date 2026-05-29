import { dts } from "rollup-plugin-dts";

// Roll the public type surface (rooted at the service entry) into a single,
// self-contained dist/public.d.ts. We ship .ts source, so we want only the
// declaration bundle — no JS emit. Internal #src/* modules are inlined;
// peer-dependency types are kept external (the consumer has them as peers).
export default {
  input: "src/service/service.ts",
  output: { file: "dist/public.d.ts", format: "es" },
  external: [/^@earendil-works\//, "@sinclair/typebox"],
  plugins: [dts({ tsconfig: "./tsconfig.json" })],
};
