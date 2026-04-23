export type TextBlock = {
  id: string;
  type: 'text';
  markdown: string;
};

export type ImageRowImage = {
  url: string;
  alt?: string;
  caption?: string;
};

export type ImageRowBlock = {
  id: string;
  type: 'image_row';
  layout: 'single' | 'double';
  images: ImageRowImage[];
};

export type ContentBlock = TextBlock | ImageRowBlock;

export type SerializedTextBlock = {
  type: 'text';
  markdown: string;
};

export type SerializedImageRowBlock = {
  type: 'image_row';
  layout: 'single' | 'double';
  images: ImageRowImage[];
};

export type SerializedContentBlock = SerializedTextBlock | SerializedImageRowBlock;

type RawContentBlock =
  | {
      type: 'text';
      markdown?: string;
    }
  | {
      type: 'image_row';
      layout?: 'single' | 'double';
      images?: ImageRowImage[];
    };

export function createTextBlock(markdown = ''): TextBlock {
  return {
    id: createBlockId(),
    type: 'text',
    markdown,
  };
}

export function createImageRowBlock(layout: 'single' | 'double' = 'single'): ImageRowBlock {
  return {
    id: createBlockId(),
    type: 'image_row',
    layout,
    images: createImagePlaceholders(layout),
  };
}

export function normalizeContentBlocks(raw: unknown, legacyContent = ''): ContentBlock[] {
  const blocks = Array.isArray(raw) ? raw : [];
  const normalized = blocks.flatMap((block) => normalizeBlock(block));

  if (normalized.length > 0) {
    return normalized;
  }

  return [createTextBlock(legacyContent)];
}

export function serializeContentBlocks(blocks: ContentBlock[]): SerializedContentBlock[] {
  const serialized: SerializedContentBlock[] = [];

  blocks.forEach((block) => {
    if (block.type === 'text') {
      const markdown = block.markdown.trim();
      if (markdown.length > 0) {
        serialized.push({
          type: 'text',
          markdown,
        });
      }
      return;
    }

    const images = block.images
      .map((image) => ({
        url: image.url.trim(),
        alt: image.alt || '',
        caption: image.caption || '',
      }))
      .filter((image) => image.url.length > 0);

    const expected = block.layout === 'double' ? 2 : 1;
    if (images.length === expected) {
      serialized.push({
        type: 'image_row',
        layout: block.layout,
        images,
      });
    }
  });

  return serialized;
}

export function deriveLegacyContent(blocks: ContentBlock[]) {
  return blocks
    .filter((block): block is TextBlock => block.type === 'text')
    .map((block) => block.markdown.trim())
    .filter(Boolean)
    .join('\n\n');
}

export function syncImageRowLayout(block: ImageRowBlock, layout: 'single' | 'double'): ImageRowBlock {
  const nextImages = [...block.images];
  const expected = layout === 'double' ? 2 : 1;

  while (nextImages.length < expected) {
    nextImages.push({ url: '', alt: '', caption: '' });
  }

  return {
    ...block,
    layout,
    images: nextImages.slice(0, expected),
  };
}

function normalizeBlock(block: unknown): ContentBlock[] {
  if (!block || typeof block !== 'object') {
    return [];
  }

  const raw = block as RawContentBlock;

  if (raw.type === 'text') {
    return [createTextBlock(raw.markdown ?? '')];
  }

  if (raw.type === 'image_row') {
    const layout = raw.layout === 'double' ? 'double' : 'single';
    const images = Array.isArray(raw.images) ? raw.images : [];
    const placeholders = createImagePlaceholders(layout);

    return [
      {
        id: createBlockId(),
        type: 'image_row',
        layout,
        images: placeholders.map((placeholder, index) => {
          const image = images[index];
          return {
            url: typeof image?.url === 'string' ? image.url : placeholder.url,
            alt: typeof image?.alt === 'string' ? image.alt : '',
            caption: typeof image?.caption === 'string' ? image.caption : '',
          };
        }),
      },
    ];
  }

  return [];
}

function createImagePlaceholders(layout: 'single' | 'double') {
  const count = layout === 'double' ? 2 : 1;
  return Array.from({ length: count }, () => ({
    url: '',
    alt: '',
    caption: '',
  }));
}

function createBlockId() {
  return `block-${Math.random().toString(36).slice(2, 10)}`;
}
