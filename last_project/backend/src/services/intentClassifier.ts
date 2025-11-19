export class IntentClassifier {
  classify(text: string): 'simple' | 'complex' {
    const complexKeywords = [
      '레시피', '만들어', '요리법', '어떻게 만들', '재료', 
      '추천', '검색', '찾아줘', '알려줘'
    ];

    return complexKeywords.some(k => text.includes(k)) ? 'complex' : 'simple';
  }
}