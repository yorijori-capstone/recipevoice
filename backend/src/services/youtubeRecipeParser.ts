/**
 * YouTube Recipe Parser
 * Parses structured recipes from YouTube descriptions and comments
 */

export interface ParsedIngredient {
  name: string;
  amount: string;
  unit?: string;
  originalText: string;
}

export interface ParsedStep {
  stepNumber: number;
  instruction: string;
  duration?: string;
}

export interface ParsedRecipe {
  title: string;
  ingredients: ParsedIngredient[];
  steps: ParsedStep[];
  servings?: string;
  cookTime?: string;
  tips?: string[];
  source: 'comment' | 'description';
}

export class YoutubeRecipeParser {
  /**
   * Try to parse a recipe from text (comment or description)
   */
  parseRecipe(text: string, source: 'comment' | 'description'): ParsedRecipe | null {
    if (!text || text.length < 50) {
      return null;
    }

    // Check if text looks like a recipe
    if (!this.looksLikeRecipe(text)) {
      console.log(`[Recipe Parser] Text doesn't look like a recipe (${source})`);
      return null;
    }

    console.log(`[Recipe Parser] Attempting to parse recipe from ${source}`);

    const ingredients = this.extractIngredients(text);
    const steps = this.extractSteps(text);

    // Validation: need at least 2 ingredients and 2 steps
    if (ingredients.length < 2 || steps.length < 2) {
      console.log(`[Recipe Parser] Insufficient data: ${ingredients.length} ingredients, ${steps.length} steps`);
      return null;
    }

    const servings = this.extractServings(text);
    const cookTime = this.extractCookTime(text);
    const tips = this.extractTips(text);

    console.log(`[Recipe Parser] Successfully parsed: ${ingredients.length} ingredients, ${steps.length} steps`);

    return {
      title: '', // Will be filled by caller
      ingredients,
      steps,
      servings,
      cookTime,
      tips,
      source,
    };
  }

  /**
   * Check if text looks like a recipe
   */
  private looksLikeRecipe(text: string): boolean {
    // Korean ingredient/measurement patterns
    const ingredientPatterns = [
      /\d+g\b/gi,           // 100g
      /\d+ml\b/gi,          // 200ml
      /\d+큰술/g,           // 2큰술
      /\d+작은술/g,         // 1작은술
      /\d+개\b/g,           // 3개
      /\d+컵\b/g,           // 1컵
      /\d+T\b/g,            // 2T (tablespoon)
      /\d+t\b/g,            // 1t (teaspoon)
      /\d+스푼/g,           // 2스푼
      /\d+C\b/g,            // 1C (cup)
    ];

    // Step number patterns
    const stepPatterns = [
      /^\d+\./m,            // 1. 2. 3.
      /^\d+\)/m,            // 1) 2) 3)
      /^-\s+/m,             // - item
      /^•\s+/m,             // • item
      /^▪\s+/m,             // ▪ item
    ];

    // Section headers
    const sectionPatterns = [
      /\[재료\]/i,
      /\[조리법\]/i,
      /\[만드는법\]/i,
      /재료:/i,
      /조리법:/i,
      /ingredients/i,
      /recipe/i,
    ];

    let matchCount = 0;

    // Count ingredient patterns
    for (const pattern of ingredientPatterns) {
      if (pattern.test(text)) {
        matchCount++;
      }
    }

    // Count step patterns
    for (const pattern of stepPatterns) {
      if (pattern.test(text)) {
        matchCount++;
      }
    }

    // Count section headers
    for (const pattern of sectionPatterns) {
      if (pattern.test(text)) {
        matchCount += 2; // Section headers are strong indicators
      }
    }

    // Need at least 4 matches to consider it a recipe
    return matchCount >= 4;
  }

  /**
   * Extract ingredients from text
   */
  private extractIngredients(text: string): ParsedIngredient[] {
    const ingredients: ParsedIngredient[] = [];

    // Find ingredient section
    const ingredientSection = this.findSection(text, [
      '재료',
      '준비물',
      '필요한 재료',
      'Ingredients',
      '재료:',
      '[재료]',
    ]);

    if (!ingredientSection) {
      // Try to extract from entire text
      return this.parseIngredientLines(text);
    }

    return this.parseIngredientLines(ingredientSection);
  }

  /**
   * Parse ingredient lines
   */
  private parseIngredientLines(text: string): ParsedIngredient[] {
    const ingredients: ParsedIngredient[] = [];
    const lines = text.split('\n');

    // Pattern to match ingredient lines
    // Examples: "양파 1개", "간장 2큰술", "소금 100g", "물 200ml"
    const ingredientPattern = /^[•▪-]?\s*(.+?)\s+(\d+(?:\.\d+)?)\s*(g|ml|큰술|작은술|개|컵|T|t|C|스푼|L|cc)?\s*$/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 2) continue;

      const match = trimmed.match(ingredientPattern);
      if (match) {
        const [, name, amount, unit] = match;
        ingredients.push({
          name: name.trim(),
          amount: amount.trim(),
          unit: unit?.trim(),
          originalText: trimmed,
        });
      } else {
        // Try alternative pattern: "100g 양파", "2큰술 간장"
        const altPattern = /^[•▪-]?\s*(\d+(?:\.\d+)?)\s*(g|ml|큰술|작은술|개|컵|T|t|C|스푼|L|cc)?\s+(.+?)$/;
        const altMatch = trimmed.match(altPattern);
        if (altMatch) {
          const [, amount, unit, name] = altMatch;
          ingredients.push({
            name: name.trim(),
            amount: amount.trim(),
            unit: unit?.trim(),
            originalText: trimmed,
          });
        } else if (this.containsIngredientKeywords(trimmed)) {
          // Fallback: line contains ingredient-like words
          ingredients.push({
            name: trimmed,
            amount: '적당량',
            originalText: trimmed,
          });
        }
      }
    }

    return ingredients;
  }

  /**
   * Extract cooking steps from text
   */
  private extractSteps(text: string): ParsedStep[] {
    const steps: ParsedStep[] = [];

    // Find steps section
    const stepsSection = this.findSection(text, [
      '조리법',
      '만드는법',
      '만드는 법',
      '조리 순서',
      'Recipe',
      'Steps',
      '만들기',
      '[조리법]',
      '[만드는법]',
    ]);

    const sourceText = stepsSection || text;
    const lines = sourceText.split('\n');

    let stepNumber = 1;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 5) continue;

      // Pattern: "1. instruction" or "1) instruction" or "- instruction"
      const stepMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/) ||
                       trimmed.match(/^[•▪-]\s+(.+)$/);

      if (stepMatch) {
        const instruction = stepMatch[2] || stepMatch[1];

        // Try to extract duration from instruction
        const duration = this.extractDurationFromText(instruction);

        steps.push({
          stepNumber: stepNumber++,
          instruction: instruction.trim(),
          duration,
        });
      }
    }

    // If no numbered steps found, try to parse paragraphs
    if (steps.length === 0) {
      const paragraphs = sourceText.split(/\n\n+/);
      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (trimmed.length > 10 && this.looksLikeInstruction(trimmed)) {
          steps.push({
            stepNumber: stepNumber++,
            instruction: trimmed,
            duration: this.extractDurationFromText(trimmed),
          });
        }
      }
    }

    return steps;
  }

  /**
   * Extract servings information
   */
  private extractServings(text: string): string | undefined {
    const servingPatterns = [
      /(\d+)인분/,
      /(\d+)~(\d+)인분/,
      /(\d+)명분/,
      /serves?\s+(\d+)/i,
    ];

    for (const pattern of servingPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return undefined;
  }

  /**
   * Extract cooking time
   */
  private extractCookTime(text: string): string | undefined {
    const timePatterns = [
      /(\d+)분\s*소요/,
      /조리시간[:\s]+(\d+)분/,
      /소요시간[:\s]+(\d+)분/,
      /(\d+)시간\s*(\d+)?분/,
      /cook\s*time[:\s]+(\d+)\s*min/i,
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return undefined;
  }

  /**
   * Extract tips from text
   */
  private extractTips(text: string): string[] {
    const tips: string[] = [];

    const tipSection = this.findSection(text, [
      '팁',
      'Tip',
      '주의사항',
      '참고',
      '꿀팁',
      '[팁]',
      '[주의]',
    ]);

    if (tipSection) {
      const lines = tipSection.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 5) {
          tips.push(trimmed);
        }
      }
    }

    return tips;
  }

  /**
   * Find a section in text by keywords
   */
  private findSection(text: string, keywords: string[]): string | null {
    for (const keyword of keywords) {
      const regex = new RegExp(`${keyword}[:\s]*([\\s\\S]*?)(?=\\n\\n|\\[|$)`, 'i');
      const match = text.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * Check if text contains ingredient keywords
   */
  private containsIngredientKeywords(text: string): boolean {
    const keywords = [
      '양파', '마늘', '간장', '소금', '후추', '설탕', '식용유', '참기름',
      '고추', '파', '생강', '물', '육수', '밀가루', '전분', '계란', '달걀',
      '돼지고기', '소고기', '닭고기', '해물', '야채', '채소',
    ];

    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Check if text looks like a cooking instruction
   */
  private looksLikeInstruction(text: string): boolean {
    const instructionKeywords = [
      '넣어', '볶아', '끓여', '섞어', '잘라', '썰어', '준비',
      '데쳐', '삶아', '튀겨', '구워', '재워', '담가',
      'add', 'stir', 'cook', 'cut', 'mix', 'boil',
    ];

    const lowerText = text.toLowerCase();
    return instructionKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Extract duration from instruction text
   */
  private extractDurationFromText(text: string): string | undefined {
    const durationPatterns = [
      /(\d+)분\s*(?:간|동안)/,
      /(\d+)분\s*정도/,
      /약\s*(\d+)분/,
      /(\d+)초/,
      /(\d+)\s*min/i,
      /(\d+)\s*sec/i,
    ];

    for (const pattern of durationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return undefined;
  }
}
