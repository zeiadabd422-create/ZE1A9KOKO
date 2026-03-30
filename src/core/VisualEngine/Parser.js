import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import { parseColor } from '../../utils/parseColor.js';

function safeGetPath(object, path) {
  if (!object || typeof path !== 'string') return undefined;
  return path.split('.').reduce((acc, segment) => {
    if (acc === undefined || acc === null) return undefined;
    return acc[segment];
  }, object);
}

function safeEvaluate(expression, context = {}) {
  if (expression == null || expression === '') return '';
  if (typeof expression !== 'string') return expression;
  const knownValue = safeGetPath(context, expression.trim());
  if (knownValue !== undefined) return knownValue;
  if (/^[a-zA-Z_$][0-9a-zA-Z_$]*(\.[a-zA-Z_$][0-9a-zA-Z_$]*)*$/.test(expression.trim())) {
    return '';
  }

  try {
    const sandbox = {
      ...context,
      user: {
        ...(context.user || {}),
        hasRole: (roleId) => {
          const roles = context.user?.roles || [];
          if (Array.isArray(roles)) {
            return roles.includes(roleId);
          }
          if (typeof roles === 'string') {
            return roles === roleId;
          }
          return false;
        },
      },
      guild: context.guild || {},
      state: context.state,
      context,
    };
    const fn = new Function('ctx', `with (ctx) { return (${expression}); }`);
    return fn(sandbox);
  } catch (error) {
    console.warn('[VisualParser] safeEvaluate failed:', expression, error);
    return '';
  }
}

function interpolate(text, context = {}) {
  if (text == null || text === false) return '';
  if (typeof text !== 'string') return text;
  return text.replace(/\{([^}]+)\}/g, (_, key) => {
    const expr = key.trim();
    const pathValue = safeGetPath(context, expr);
    if (pathValue !== undefined && pathValue !== null) {
      return String(pathValue);
    }
    const evalValue = safeEvaluate(expr, context);
    if (evalValue !== undefined && evalValue !== null && evalValue !== '') {
      return String(evalValue);
    }
    return '';
  });
}

function evaluateCondition(condition, context = {}) {
  if (typeof condition === 'boolean') return condition;
  if (typeof condition === 'function') {
    try {
      return Boolean(condition(context));
    } catch {
      return false;
    }
  }
  if (typeof condition !== 'string') return Boolean(condition);
  return Boolean(safeEvaluate(condition, context));
}

function parseButtonStyle(style) {
  if (!style) return ButtonStyle.Secondary;
  if (typeof style === 'string') {
    const normalized = style.trim().toLowerCase();
    switch (normalized) {
      case 'primary':
        return ButtonStyle.Primary;
      case 'secondary':
        return ButtonStyle.Secondary;
      case 'success':
        return ButtonStyle.Success;
      case 'danger':
        return ButtonStyle.Danger;
      case 'link':
        return ButtonStyle.Link;
      default:
        return ButtonStyle.Secondary;
    }
  }
  if (typeof style === 'number') {
    return style;
  }
  return ButtonStyle.Secondary;
}

function resolveState(raw, context = {}) {
  if (!raw || typeof raw !== 'object') return raw;
  if (!raw.states || typeof raw.states !== 'object') return raw;
  const target = context.state || 'initial';
  const states = raw.states;
  const selectedState = states[target] || states.initial || states.default || null;
  if (selectedState && typeof selectedState === 'object') {
    return {
      ...raw,
      ...selectedState,
      states: undefined,
    };
  }
  return {
    ...raw,
    states: undefined,
  };
}

function buildEmbed(data = {}, context = {}) {
  if (data.if !== undefined && !evaluateCondition(data.if, context)) {
    return null;
  }

  const embed = new EmbedBuilder();
  const title = interpolate(data.title, context);
  const description = interpolate(data.description, context);
  const url = interpolate(data.url, context);
  const timestamp = data.timestamp || data.ts || null;
  const color = data.color ? parseColor(interpolate(data.color, context)) : undefined;

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (url) embed.setURL(url);
  if (timestamp) embed.setTimestamp(timestamp);
  if (color !== undefined) embed.setColor(color);

  if (data.author && typeof data.author === 'object') {
    const author = {
      name: interpolate(data.author.name, context) || undefined,
      url: interpolate(data.author.url, context) || undefined,
      iconURL: interpolate(data.author.iconURL || data.author.icon, context) || undefined,
    };
    embed.setAuthor(author);
  }

  if (data.footer && typeof data.footer === 'object') {
    const footer = {
      text: interpolate(data.footer.text, context) || undefined,
      iconURL: interpolate(data.footer.iconURL || data.footer.icon, context) || undefined,
    };
    embed.setFooter(footer);
  }

  if (data.thumbnail) {
    embed.setThumbnail(interpolate(data.thumbnail, context));
  }

  if (data.image) {
    embed.setImage(interpolate(data.image, context));
  }

  if (Array.isArray(data.fields)) {
    const fields = data.fields
      .slice(0, 25)
      .map((field) => ({
        name: interpolate(field.name, context),
        value: interpolate(field.value, context),
        inline: Boolean(field.inline),
      }))
      .filter((field) => field.name && field.value);
    if (fields.length) {
      embed.setFields(fields);
    }
  }

  return embed;
}

function buildButton(def, context = {}) {
  if (def.if !== undefined && !evaluateCondition(def.if, context)) {
    return null;
  }

  const label = interpolate(def.label, context);
  const customId = interpolate(def.customId || def.custom_id || def.id, context);
  const url = interpolate(def.url, context);
  const emoji = def.emoji || null;
  const style = parseButtonStyle(def.style);
  const isLink = style === ButtonStyle.Link || (!!url && !customId);

  const button = new ButtonBuilder();
  if (label) button.setLabel(label);
  if (isLink) {
    if (url) button.setURL(url);
    button.setStyle(ButtonStyle.Link);
  } else {
    if (customId) button.setCustomId(customId);
    button.setStyle(style);
  }

  if (def.disabled === true) button.setDisabled(true);
  if (def.disabled === false) button.setDisabled(false);
  if (emoji) button.setEmoji(interpolate(emoji, context));

  return button;
}

function buildSelectMenu(def, context = {}) {
  if (def.if !== undefined && !evaluateCondition(def.if, context)) {
    return null;
  }

  const customId = interpolate(def.customId || def.custom_id || def.id, context);
  const placeholder = interpolate(def.placeholder, context);
  const minValues = Number(def.minValues || def.min_values || 1);
  const maxValues = Number(def.maxValues || def.max_values || 1);
  const disabled = Boolean(def.disabled);

  const options = (def.options || def.choices || [])
    .filter((item) => item && item.value && item.label)
    .slice(0, 25)
    .map((item) => ({
      label: interpolate(item.label, context),
      value: interpolate(item.value, context),
      description: item.description ? interpolate(item.description, context) : undefined,
      emoji: item.emoji ? interpolate(item.emoji, context) : undefined,
      default: Boolean(item.default),
    }));

  const menu = new StringSelectMenuBuilder();
  if (customId) menu.setCustomId(customId);
  if (placeholder) menu.setPlaceholder(placeholder);
  if (Number.isInteger(minValues) && minValues > 0) menu.setMinValues(minValues);
  if (Number.isInteger(maxValues) && maxValues > 0) menu.setMaxValues(maxValues);
  if (options.length) menu.setOptions(options);
  if (disabled) menu.setDisabled(true);

  return menu;
}

function buildActionRows(components = [], context = {}) {
  const rows = [];
  const flatComponents = [];

  if (Array.isArray(components)) {
    components.forEach((item) => {
      if (item && typeof item === 'object' && (item.type === 1 || item.components)) {
        const childList = item.components || [];
        childList.forEach((child) => flatComponents.push(child));
      } else {
        flatComponents.push(item);
      }
    });
  }

  if (!flatComponents.length) return rows;

  const row = new ActionRowBuilder();
  flatComponents.forEach((component) => {
    if (!component || typeof component !== 'object') return;
    let builtComponent = null;
    const type = (component.type || '').toString().toLowerCase();
    if (type === 'button' || component.style || component.customId || component.url) {
      builtComponent = buildButton(component, context);
    } else if (type === 'select' || type === 'stringselect' || type === 'selectmenu') {
      builtComponent = buildSelectMenu(component, context);
    } else if (component.options) {
      builtComponent = buildSelectMenu(component, context);
    } else if (component.label || component.customId || component.url) {
      builtComponent = buildButton(component, context);
    }
    if (builtComponent) {
      row.addComponents(builtComponent);
    }
  });

  if (row.components.length > 0) {
    rows.push(row);
  }
  return rows;
}

function prepareContext(raw, context = {}) {
  const normalizedContext = { ...context };
  if (raw.variables && typeof raw.variables === 'object') {
    Object.assign(normalizedContext, raw.variables);
  }
  if (raw.db && typeof raw.db === 'object') {
    Object.assign(normalizedContext, raw.db);
  }
  if (normalizedContext.database && typeof normalizedContext.database === 'object') {
    Object.assign(normalizedContext, normalizedContext.database);
  }
  return normalizedContext;
}

export class VisualParser {
  parse(jsonData = {}, context = {}) {
    try {
      const raw = jsonData && typeof jsonData === 'object' ? jsonData : {};
      const runtimeContext = prepareContext(raw, context);
      const stateResolved = resolveState(raw, runtimeContext);

      let embedDefs = [];
      if (Array.isArray(stateResolved)) {
        embedDefs = stateResolved;
      } else if (Array.isArray(stateResolved.embeds)) {
        embedDefs = stateResolved.embeds;
      } else if (stateResolved.embed || stateResolved.data) {
        embedDefs = [stateResolved.embed || stateResolved.data];
      } else {
        embedDefs = [stateResolved];
      }

      const embeds = embedDefs
        .filter((item) => item && typeof item === 'object')
        .map((embedDef) => buildEmbed(embedDef, runtimeContext))
        .filter(Boolean);

      const componentsData = stateResolved.components || stateResolved.actionRows || stateResolved.actions || [];
      const actionRows = buildActionRows(componentsData, runtimeContext);

      return {
        embeds,
        components: actionRows,
      };
    } catch (error) {
      console.error('[VisualParser] parse() failed:', error);
      return {
        embeds: [],
        components: [],
      };
    }
  }
}

export default VisualParser;
