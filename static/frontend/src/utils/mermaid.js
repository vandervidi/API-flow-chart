export function generateMermaidString(data) {
    if (!data || !data.actors || data.actors.length === 0 || !data.steps || data.steps.length === 0) {
        return '';
    }

    let mermaidStr = 'sequenceDiagram\n';
    mermaidStr += '  autonumber\n\n';

    data.actors.forEach(actor => {
        mermaidStr += `  participant ${actor.replace(/[^a-zA-Z0-9_]/g, '')} as ${actor}\n`;
    });

    mermaidStr += '\n';

    data.steps.forEach(step => {
        const from = step.from.replace(/[^a-zA-Z0-9_]/g, '') || data.actors[0].replace(/[^a-zA-Z0-9_]/g, '');
        const to = step.to.replace(/[^a-zA-Z0-9_]/g, '') || data.actors[0].replace(/[^a-zA-Z0-9_]/g, '');
        let label = step.endpoint || 'Call';
        if (step.description) {
            label += ` - ${step.description}`;
        }
        label = label.replace(/"/g, "'");
        mermaidStr += `  ${from}->>${to}: ${label}\n`;
    });

    return mermaidStr;
}
