from deep_translator import GoogleTranslator

translator = GoogleTranslator(source='en', target='is')
res = translator.translate("What is the capital of France?")
print(res)
