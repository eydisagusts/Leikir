using System.Text.Json;

namespace Leikir.Data.Games.Hangman;

using System;
using System.Collections.Generic;
using System.IO;

public class TargetWordList
{
    private List<string> _targetWords;
    private Random _random;
    private readonly string _targetWordsPath;

    public TargetWordList()
    {
        _targetWords = new List<string>();
        _random = new Random();
        
        // Set path relative to the application root
        _targetWordsPath = Path.Combine("Data", "Games", "Words", "hangman", "target_words.json");
        
        LoadWords();
    }

    private void LoadWords()
    {
        try
        {
            if (File.Exists(_targetWordsPath))
            {
                var json = File.ReadAllText(_targetWordsPath);
                var targetWords = JsonSerializer.Deserialize<TargetWords>(json);
                if (targetWords?.Words != null)
                {
                    _targetWords.AddRange(targetWords.Words);
                }
            }
            else
            {
                throw new FileNotFoundException($"Target words file not found at {_targetWordsPath}");
            }
        }
        catch (Exception ex)
        {
            // Log the error and rethrow
            Console.WriteLine($"Error loading words: {ex.Message}");
            throw;
        }
    }

    public string GetRandomWord()
    {
        if (_targetWords.Count == 0)
        {
            throw new InvalidOperationException("No target words available");
        }
        return _targetWords[_random.Next(_targetWords.Count)].ToUpper();
    }

    public bool IsValidWord(string word)
    {
        return _targetWords.Contains(word.ToUpper());
    }

    private class TargetWords
    {
        public List<string> Words { get; set; } = new();
    }
}