import pptxgen from 'pptxgenjs';

export async function generatePitchPptx(title: string, markdownContent: string): Promise<Buffer> {
  const pptx = new pptxgen();

  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';

  const DARK_BG   = '050509';
  const SURFACE   = '0d0d14';
  const CYAN      = '00d9ff';
  const TEXT_MAIN = 'e2e8f0';
  const TEXT_MUTED = '8892a4';

  // Parse sections from markdown (## heading = slide)
  const sections = markdownContent.split(/^## /m).filter(Boolean);

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: DARK_BG };
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.08, h: 7.5, fill: { color: CYAN },
  });
  titleSlide.addText(title, {
    x: 0.5, y: 2.5, w: 12, h: 1.2,
    fontSize: 32, bold: true, color: TEXT_MAIN, fontFace: 'Inter',
  });
  titleSlide.addText('Prepared by Vani AI Sales Intelligence', {
    x: 0.5, y: 3.9, w: 10, h: 0.5,
    fontSize: 14, color: TEXT_MUTED, fontFace: 'Inter',
  });
  let appDomain = 'Vani AI';
  try {
    if (typeof process.env.NEXT_PUBLIC_APP_URL === 'string' && process.env.NEXT_PUBLIC_APP_URL) {
      appDomain = new URL(process.env.NEXT_PUBLIC_APP_URL).host;
    }
  } catch { /* use default */ }
  titleSlide.addText(appDomain, {
    x: 0.5, y: 6.8, w: 5, h: 0.4,
    fontSize: 10, color: CYAN, fontFace: 'Inter',
  });

  // Content slides
  for (const section of sections) {
    const lines = section.split('\n').filter(Boolean);
    const heading = lines[0] ?? '';
    const body = lines.slice(1).join('\n').trim();

    const slide = pptx.addSlide();
    slide.background = { color: DARK_BG };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: CYAN },
    });
    slide.addText(heading, {
      x: 0.5, y: 0.3, w: 12, h: 0.8,
      fontSize: 22, bold: true, color: CYAN, fontFace: 'Inter',
    });

    // Parse bullet points
    const bullets = body.split('\n')
      .filter((l) => l.startsWith('- ') || l.startsWith('* ') || l.match(/^\d+\./))
      .map((l) => l.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));

    if (bullets.length > 0) {
      slide.addText(
        bullets.map((b) => ({ text: b, options: { bullet: true, color: TEXT_MAIN } })),
        { x: 0.5, y: 1.3, w: 12, h: 5.5, fontSize: 16, fontFace: 'Inter', color: TEXT_MAIN }
      );
    } else {
      slide.addText(body, {
        x: 0.5, y: 1.3, w: 12, h: 5.5,
        fontSize: 14, color: TEXT_MUTED, fontFace: 'Inter', wrap: true,
      });
    }
  }

  // Return as buffer
  const data = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
  return data;
}
