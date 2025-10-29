/**
 * Lightweight Document Scanner
 *
 * Keyword flagging without OCR or deep reading
 * Speed: 1 second vs 30-60 seconds for full OCR
 *
 * Approach:
 * 1. Boolean check for key terms in filename
 * 2. Metadata extraction (title, author, date)
 * 3. First-page text extraction only (if quick)
 *
 * Deep reading is deferred to on-demand analysis
 */

import pdf from 'pdf-parse';

export interface DocumentScanResult {
  filename: string;
  hasKeywords: boolean;
  flaggedAs: string[];
  metadata: {
    title?: string;
    author?: string;
    createdAt?: Date;
    pageCount?: number;
  };
  quickScanText?: string; // First page only
  processingTimeMs: number;
}

/**
 * Keyword patterns for document flagging
 */
const KEYWORD_PATTERNS = {
  brand_guidelines: /\b(brand|guidelines?|style\s*guide|visual\s*identity|logo\s*usage)\b/i,
  copy: /\b(copy|content|messaging|text|headlines?|body\s*copy)\b/i,
  campaign_brief: /\b(brief|campaign|project\s*overview|creative\s*brief|rip|rfp)\b/i,
  specs: /\b(spec|specification|dimension|requirement|deliverable)\b/i,
  reference: /\b(reference|inspiration|mood\s*board|example|competitive)\b/i
};

/**
 * Scan filename for document type keywords
 *
 * @param filename - Original filename
 * @returns Array of matched categories
 */
export function scanFilename(filename: string): string[] {
  const matches: string[] = [];

  Object.entries(KEYWORD_PATTERNS).forEach(([category, pattern]) => {
    if (pattern.test(filename)) {
      matches.push(category);
    }
  });

  return matches;
}

/**
 * Quick scan of PDF document
 * Extracts metadata and optionally first page text
 *
 * @param buffer - PDF file buffer
 * @param filename - Original filename
 * @param extractFirstPage - Whether to extract first page text (default false)
 * @returns Document scan result
 */
export async function quickScanPDF(
  buffer: Buffer,
  filename: string,
  extractFirstPage: boolean = false
): Promise<DocumentScanResult> {
  const startTime = Date.now();
  const flaggedAs = scanFilename(filename);

  try {
    const data = await pdf(buffer, {
      max: extractFirstPage ? 1 : 0 // Only parse first page if requested
    });

    const metadata = {
      title: data.info?.Title,
      author: data.info?.Author,
      createdAt: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
      pageCount: data.numpages
    };

    // Check metadata for keywords
    const metadataText = (metadata.title || '') + ' ' + (metadata.author || '');
    Object.entries(KEYWORD_PATTERNS).forEach(([category, pattern]) => {
      if (pattern.test(metadataText) && !flaggedAs.includes(category)) {
        flaggedAs.push(category);
      }
    });

    // Check first page text for keywords if extracted
    let quickScanText: string | undefined;
    if (extractFirstPage && data.text) {
      quickScanText = data.text.substring(0, 500); // First 500 chars only

      Object.entries(KEYWORD_PATTERNS).forEach(([category, pattern]) => {
        if (pattern.test(quickScanText!) && !flaggedAs.includes(category)) {
          flaggedAs.push(category);
        }
      });
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      filename,
      hasKeywords: flaggedAs.length > 0,
      flaggedAs,
      metadata,
      quickScanText,
      processingTimeMs
    };
  } catch (error) {
    // PDF parsing failed, fall back to filename scanning only
    const processingTimeMs = Date.now() - startTime;

    return {
      filename,
      hasKeywords: flaggedAs.length > 0,
      flaggedAs,
      metadata: {},
      processingTimeMs
    };
  }
}

/**
 * Scan Word/text document for keywords
 * Currently just filename-based, can be enhanced with metadata extraction
 *
 * @param filename - Original filename
 * @returns Document scan result
 */
export function quickScanDocument(filename: string): DocumentScanResult {
  const startTime = Date.now();
  const flaggedAs = scanFilename(filename);
  const processingTimeMs = Date.now() - startTime;

  return {
    filename,
    hasKeywords: flaggedAs.length > 0,
    flaggedAs,
    metadata: {},
    processingTimeMs
  };
}

/**
 * Batch scan multiple documents
 * Processes PDFs in parallel for speed
 *
 * @param documents - Array of {filename, buffer, type} objects
 * @param extractFirstPage - Whether to extract first page for PDFs
 * @returns Array of scan results
 */
export async function batchScanDocuments(
  documents: Array<{ filename: string; buffer: Buffer; type: 'pdf' | 'document' }>,
  extractFirstPage: boolean = false
): Promise<DocumentScanResult[]> {
  const scanPromises = documents.map(async (doc) => {
    if (doc.type === 'pdf') {
      return quickScanPDF(doc.buffer, doc.filename, extractFirstPage);
    } else {
      return quickScanDocument(doc.filename);
    }
  });

  return Promise.all(scanPromises);
}

/**
 * Identify brand guidelines document from scan results
 *
 * @param scanResults - Results from batchScanDocuments
 * @returns Filename of most likely brand guidelines document, or null
 */
export function identifyBrandGuidelines(scanResults: DocumentScanResult[]): string | null {
  const brandDocs = scanResults
    .filter(r => r.flaggedAs.includes('brand_guidelines'))
    .sort((a, b) => {
      // Prioritize by number of keywords matched
      return b.flaggedAs.length - a.flaggedAs.length;
    });

  return brandDocs.length > 0 ? brandDocs[0].filename : null;
}

/**
 * Identify campaign brief document from scan results
 *
 * @param scanResults - Results from batchScanDocuments
 * @returns Filename of most likely brief document, or null
 */
export function identifyCampaignBrief(scanResults: DocumentScanResult[]): string | null {
  const briefDocs = scanResults
    .filter(r => r.flaggedAs.includes('campaign_brief'))
    .sort((a, b) => b.flaggedAs.length - a.flaggedAs.length);

  return briefDocs.length > 0 ? briefDocs[0].filename : null;
}
