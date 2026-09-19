import {getRequestConfig} from "next-intl/server";
import {isLocale} from "./routing";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";

const messages = {en, ru};

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : "ru";
  return {locale, messages: messages[locale]};
});
