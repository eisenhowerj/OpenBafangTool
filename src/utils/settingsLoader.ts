import fs from 'fs';
import path from 'path';
import toml from '@iarna/toml';

export type SettingsObject = Record<string, Record<string, number>>;

export function loadSettingsFile(filePath: string): SettingsObject {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Try TOML first
    try {
        return toml.parse(content) as SettingsObject;
    } catch (e) {
        // Fallback: parse TXT format
        return parseTxtSettings(content);
    }
}

export function saveSettingsFile(filePath: string, settings: SettingsObject): void {
    const tomlString = toml.stringify(settings);
    fs.writeFileSync(filePath, tomlString, 'utf-8');
}

function parseTxtSettings(content: string): SettingsObject {
    const lines = content.split(/\r?\n/);
    const result: SettingsObject = {};
    let currentSection = '';
    for (const line of lines) {
        if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
            currentSection = line.trim().slice(1, -1);
            result[currentSection] = {};
        } else if (line.includes('=') && currentSection) {
            const [key, value] = line.split('=');
            result[currentSection][key.trim()] = Number(value.trim());
        }
    }
    return result;
}

export function listPresetFiles(presetsDir: string): string[] {
    try {
        return fs.readdirSync(presetsDir)
            .filter(f => f.endsWith('.toml') || f.endsWith('.txt'))
            .map(f => path.join(presetsDir, f));
    } catch (error) {
        console.warn('Cannot read preset directory:', presetsDir, error);
        return [];
    }
}
