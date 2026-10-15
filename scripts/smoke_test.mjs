// smoke-test.mjs

const imports = [
  ['@langchain/core/prompts', 'ChatPromptTemplate'],
  ['@langchain/core/output_parsers', 'StringOutputParser'],
  ['@langchain/core/messages', 'HumanMessage'],
  ['@langchain/google', 'ChatGoogle'],
  ['@langchain/google-genai', 'GoogleGenerativeAIEmbeddings'],  // ← changed
  ['@langchain/community/document_loaders/fs/pdf', 'PDFLoader'],
  ['@langchain/textsplitters', 'RecursiveCharacterTextSplitter'],
  ['@langchain/classic/vectorstores/memory', 'MemoryVectorStore'],
  ['@langchain/classic/chains/retrieval', 'createRetrievalChain'],
  ['@langchain/classic/chains/combine_documents', 'createStuffDocumentsChain'],
];

for (const [path, name] of imports) {
  try {
    const mod = await import(path);
    const ok = name in mod ? '✓' : '✗ (missing export)';
    console.log(`${ok}  ${name.padEnd(35)} from "${path}"`);
  } catch (err) {
    console.log(`✗  ${name.padEnd(35)} from "${path}"  →  ${err.code || err.message}`);
  }
}