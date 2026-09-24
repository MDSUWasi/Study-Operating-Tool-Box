class MarkdownParser {
    parse(md) {
        if (!md) return '';
        const lines = md.split('\n');
        let html = '';
        let paragraph = [];

        const flushParagraph = () => {
            if (paragraph.length > 0) {
                html += `<p>${paragraph.map(l => this.inline(l)).join('<br>')}</p>`;
                paragraph = [];
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (/^```/.test(trimmed)) {
                flushParagraph();
                const code = [];
                i++;
                while (i < lines.length && !/^```/.test(lines[i].trim())) {
                    code.push(lines[i]);
                    i++;
                }
                html += `<pre><code>${this.escapeHtml(code.join('\n'))}</code></pre>`;
                continue;
            }

            if (i > 0 && lines[i - 1].includes('|') && this.isTableSeparator(trimmed)) {
                flushParagraph();
                const headers = lines[i - 1].split('|').map(s => s.trim()).filter(Boolean);
                const rows = [];
                i++;
                while (i < lines.length && lines[i].includes('|')) {
                    const cells = lines[i].split('|').map(s => s.trim()).filter(Boolean);
                    if (cells.length > 0) rows.push(cells);
                    i++;
                }
                html += this.renderTable(headers, rows);
                i--;
                continue;
            }

            const heading = trimmed.match(/^(#{1,6})\s+(.*)/);
            if (heading) {
                flushParagraph();
                const level = heading[1].length;
                html += `<h${level}>${this.inline(heading[2])}</h${level}>`;
                continue;
            }

            if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
                flushParagraph();
                html += '<hr>';
                continue;
            }

            if (/^>\s?/.test(trimmed)) {
                flushParagraph();
                const quoteLines = [];
                while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
                    quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
                    i++;
                }
                i--;
                html += `<blockquote>${quoteLines.map(l => this.inline(l)).join('<br>')}</blockquote>`;
                continue;
            }

            const taskMatch = trimmed.match(/^- \[([ xX])\]\s+(.*)/);
            if (taskMatch) {
                flushParagraph();
                html += '<ul>';
                const checked = taskMatch[1].toLowerCase() === 'x';
                html += `<li><input type="checkbox" disabled ${checked ? 'checked' : ''}> ${this.inline(taskMatch[2])}</li>`;
                i++;
                while (i < lines.length) {
                    const t = lines[i].trim();
                    const tm = t.match(/^- \[([ xX])\]\s+(.*)/);
                    if (tm) {
                        const c = tm[1].toLowerCase() === 'x';
                        html += `<li><input type="checkbox" disabled ${c ? 'checked' : ''}> ${this.inline(tm[2])}</li>`;
                        i++;
                    } else {
                        break;
                    }
                }
                html += '</ul>';
                i--;
                continue;
            }

            const ulMatch = trimmed.match(/^(-|\*)\s+(.*)/);
            if (ulMatch) {
                flushParagraph();
                html += '<ul>';
                html += `<li>${this.inline(ulMatch[2])}</li>`;
                i++;
                while (i < lines.length) {
                    const t = lines[i].trim();
                    const um = t.match(/^(-|\*)\s+(.*)/);
                    if (um) {
                        html += `<li>${this.inline(um[2])}</li>`;
                        i++;
                    } else {
                        break;
                    }
                }
                html += '</ul>';
                i--;
                continue;
            }

            const olMatch = trimmed.match(/^\d+\.\s+(.*)/);
            if (olMatch) {
                flushParagraph();
                html += '<ol>';
                html += `<li>${this.inline(olMatch[1])}</li>`;
                i++;
                while (i < lines.length) {
                    const t = lines[i].trim();
                    const om = t.match(/^\d+\.\s+(.*)/);
                    if (om) {
                        html += `<li>${this.inline(om[1])}</li>`;
                        i++;
                    } else {
                        break;
                    }
                }
                html += '</ol>';
                i--;
                continue;
            }

            if (trimmed === '') {
                flushParagraph();
            } else {
                paragraph.push(line);
            }
        }

        flushParagraph();
        return html;
    }

    inline(text) {
        let t = text;
        t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
        t = t.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        t = t.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');
        t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        t = t.replace(/__(.*?)__/g, '<strong>$1</strong>');
        t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
        t = t.replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
        t = t.replace(/~~(.*?)~~/g, '<del>$1</del>');
        t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
        t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        return t;
    }

    isTableSeparator(line) {
        return /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes('-');
    }

    renderTable(headers, rows) {
        if (headers.length === 0) return '';
        let table = '<table><thead><tr>';
        headers.forEach(h => { table += `<th>${this.inline(h)}</th>`; });
        table += '</tr></thead><tbody>';
        rows.forEach(row => {
            table += '<tr>';
            row.forEach(cell => { table += `<td>${this.inline(cell)}</td>`; });
            table += '</tr>';
        });
        table += '</tbody></table>';
        return table;
    }

    escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}