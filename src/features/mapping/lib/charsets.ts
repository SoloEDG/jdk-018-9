export const charsets = [
  { id: "standard", name: "经典 ASCII", value: " .:-=+*#%@" },
  { id: "blocks", name: "块状字符", value: " ░▒▓█" },
  { id: "binary", name: "二进制", value: " 01" },
  {
    id: "detail",
    name: "精细阶梯",
    value: " .`^,:;Il!i~+_-?][}{1)(|\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  },
];
export function glyphs(id: string, custom: string): string[] {
  const value =
    id === "custom"
      ? custom
      : (charsets.find((c) => c.id === id)?.value ?? charsets[0]!.value);
  const chars = [
    ...new Set(
      Array.from(value).filter((c) => c !== "\n" && c !== "\r" && c !== "\t"),
    ),
  ];
  return chars.length ? chars : [" "];
}
