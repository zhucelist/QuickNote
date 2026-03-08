/**
 * Generate a filename based on a format template and current date.
 * Supported variables: $yyyy$, $MM$, $dd$, $HH$, $mm$, $ss$
 * 
 * @param formatTemplate The template string (e.g. "Screenshot_$yyyy-MM-dd$")
 * @param defaultName Default name if template is empty
 * @returns Formatted filename (e.g. "Screenshot_2024-03-07.png")
 */
export function generateFilename(formatTemplate: string, defaultName: string = 'Screenshot'): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    // Default format if not provided
    const template = formatTemplate || `${defaultName}_$yyyy-MM-dd_HH-mm-ss$.png`;
    
    const replacements: Record<string, string> = {
        'yyyy': now.getFullYear().toString(),
        'MM': pad(now.getMonth() + 1),
        'dd': pad(now.getDate()),
        'HH': pad(now.getHours()),
        'mm': pad(now.getMinutes()),
        'ss': pad(now.getSeconds()),
    };

    // Replace $variable$ patterns
    const fileName = template.replace(/\$([^$]+)\$/g, (_match: string, key: string) => {
        // Direct match
        if (replacements[key]) {
            return replacements[key];
        }
        // Complex match (e.g. $yyyy-MM$) - replace internal variables
        let result = key;
        const timeVars = Object.keys(replacements).join('|');
        result = result.replace(new RegExp(timeVars, 'g'), (matchedVar: string) => {
            return replacements[matchedVar];
        });
        return result;
    });
    
    return fileName;
}
