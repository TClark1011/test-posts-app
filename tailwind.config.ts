import { type Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import {
  MANTINE_COLOR_NAMES,
  TAILWIND_COLOR_SHADES,
  composeSingleTailwindRgbColor,
  MANTINE_SPECIAL_COLORS,
  MANTINE_SIZES,
} from "./src/lib/theme-helpers";
import { withUt } from "uploadthing/tw";

const generateTailwindColorSetForMantineColor = (colorName: string) => {
  const colorSet: Record<string, string> = {};

  TAILWIND_COLOR_SHADES.forEach((shade) => {
    colorSet[shade] = composeSingleTailwindRgbColor(colorName, shade);
  });

  ["light", "filled", ""];

  return colorSet;
};

const mantineColorTwEntries: Record<string, string | Record<string, string>> =
  {};

MANTINE_COLOR_NAMES.forEach((color) => {
  mantineColorTwEntries[color] = generateTailwindColorSetForMantineColor(color);
});

MANTINE_SPECIAL_COLORS.forEach((colorName) => {
  mantineColorTwEntries[colorName] = composeSingleTailwindRgbColor(colorName);
});

type ComposeMantineSizeTwEntriesInput = {
  extraSizes: string[];
  twKeyPrefix: string;
};

const defaultMantineSizeTwEntriesInput: ComposeMantineSizeTwEntriesInput = {
  extraSizes: [],
  twKeyPrefix: "",
};
const composeMantineSizeTwEntries = (
  propertyName: string,
  input: Partial<ComposeMantineSizeTwEntriesInput> = {},
) => {
  const { extraSizes, twKeyPrefix } = {
    ...defaultMantineSizeTwEntriesInput,
    ...input,
  };
  const result: Record<string, string> = {};

  [...MANTINE_SIZES, ...extraSizes].forEach((size) => {
    result[`${twKeyPrefix}${size}`] = `var(--mantine-${propertyName}-${size})`;
  });

  return result;
};

const mantineSpacingEntries = composeMantineSizeTwEntries("spacing", {
  twKeyPrefix: "man_",
});

export default withUt({
  content: ["./src/**/*.tsx"],
  darkMode: ["class", '[data-mantine-color-scheme="dark"]'],
  corePlugins: {
    preflight: false, // Preflight breaks mantine styling

    // Fully disable the "divide" styles
    // It's very niche functionality and doesn't work properly
    // when we disable preflight
    divideColor: false,
    divideOpacity: false,
    divideStyle: false,
    divideWidth: false,
  },

  theme: {
    boxShadow: composeMantineSizeTwEntries("shadow"),
    borderRadius: composeMantineSizeTwEntries("radius", {
      extraSizes: ["default"],
    }),
    colors: { ...mantineColorTwEntries, transparent: "transparent" },
    fontSize: composeMantineSizeTwEntries("font-size"),
    lineHeight: composeMantineSizeTwEntries("line-height"),
    fontFamily: {
      sans: "var(--mantine-font-family)",
      mono: "var(--mantine-font-family-monospace)",
      heading: "var(--mantine-font-family-headings)",
    },
    extend: {
      spacing: { ...mantineSpacingEntries, navbarHeight: "64px" },
      maxWidth: mantineSpacingEntries,
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant("hover-focus", ["&:hover", "&:focus-visible"]);
      addVariant("hover-focus-within", ["&:hover", "&:has(:focus-visible)"]);
      addVariant("group-hover-focus", [
        ":merge(.group):hover &",
        ":merge(.group):focus-visible &",
      ]);
      addVariant("group-hover-focus-within", [
        ":merge(.group):hover &",
        ":merge(.group):has(:focus-visible) &",
      ]);
    }),
  ],
} satisfies Config);

/**
 * NOTE: We apply a prefix to the mantine spacing keys because mantine's
 * spacing values are only designed for small-scale work within components,
 * whereas tailwind's spacing is designed for both small smale work and large
 * scale page layouts. To keep both sets of values available, we prefix the
 * mantine spacing values with `man_` so that they don't conflict with the
 * tailwind values.
 */
