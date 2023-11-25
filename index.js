const Bottleneck = require('bottleneck');

const { parseLocale } = require('./parse-locale');
const { getService } = require('./get-service');


module.exports = {
  provider: 'gpt',
  name: 'GPT',
  /**
   * @param {object} providerOptions all config values in the providerOptions property
   * @param {object} pluginOptions all config values from the plugin
   */
  init(providerOptions = {}, pluginConfig = {}) {

    const limiter = new Bottleneck({
      minTime: parseInt(process.env.TRANSLATE_GPT_REQUESTS_MIN_DELAY ?? '100'),
      maxConcurrent: parseInt(process.env.TRANSLATE_GPT_MAX_CONCURRENT_REQUESTS ?? '5'),
    });

    const chatGptApiKey = process.env.CHAT_GPT_API_KEY;
    if (!chatGptApiKey) {
      throw new Error('ChatGPT API key not found. Please add CHAT_GPT_API_KEY environment variable with valid key value');
    }
    const cacheTtlMs = parseInt(process.env.TRANSLATE_GPT_CACHE_TTL_MS ?? "60000");
    const model = process.env.TRANSLATE_GPT_MODEL ?? "gpt-4";

    const translationService = strapi.service('api::translation.translation');
    translationService.init(chatGptApiKey, model, cacheTtlMs);

    return {
      /**
       * @param {{
       *  text:string|string[],
       *  sourceLocale: string,
       *  targetLocale: string,
       *  priority: number,
       *  format?: 'plain'|'markdown'|'html'
       * }} options all translate options
       * @returns {string[]} the input text(s) translated
       */
      async translate({ text, priority, sourceLocale, targetLocale, format }) {
        if (!text) {
          return [];
        }
        if (!sourceLocale || !targetLocale) {
          throw new Error('source and target locale must be defined');
        }

        const formatService = getService('format');

        const tagHandling = format === 'plain' ? undefined : 'html';

        const textArray = Array.isArray(text) ? text : [text];

        console.log("received array:");
        console.log(JSON.stringify(textArray));

        const asyncResult = textArray.map(async (text) => {
          return await limiter.schedule(() => {
            return translationService.translate({ sourceLocale, targetLocale, text });
          });
        });

        const result = await Promise.all(asyncResult);

        // if (format === 'markdown') {
        //   return formatService.htmlToMarkdown(result)
        // }

        return result;
      },
      /**
       * @returns {{count: number, limit: number}} count for the number of characters used, limit for how many can be used in the current period
       */
      async usage() {
        // Implement usage
      },
    };
  },
};
