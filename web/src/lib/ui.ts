export { cn } from "./ui/cn";

import { layout } from "./ui/layout";
import { recipes } from "./ui/recipes";
import { tables } from "./ui/tables";

export const ui = { ...layout, ...recipes, ...tables };
