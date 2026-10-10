from healwyn_voice.text import find_phrases, looks_hindi, normalize


def test_normalize_lowercases_and_strips_punctuation():
    assert normalize('Hello,  I CAN’T breathe!!') == "hello i can't breathe"
    assert normalize('सीने में दर्द है।') == 'सीने में दर्द है'


def test_latin_phrases_match_whole_words_only():
    assert find_phrases('I will pass', ['pass'])
    assert not find_phrases('my passport', ['pass'])
    assert not find_phrases('bypass', ['pass'])


def test_devanagari_phrases_allow_inflected_last_word():
    assert find_phrases('मुझे दौरा पड़ा था', ['दौरा पड़'])
    assert find_phrases('बाल झड़ रहे हैं', ['बाल झड़'])


def test_hindi_detection():
    assert looks_hindi('मुझे मदद चाहिए')
    assert looks_hindi('mujhe dard hai')
    assert not looks_hindi('I have a toothache')
