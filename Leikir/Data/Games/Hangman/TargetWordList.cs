using System.Text.Json;
using System.Text.Json.Serialization;

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
        
        // Get the application's base directory
        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        
        // Set path relative to the application root
        _targetWordsPath = Path.Combine(baseDir, "Data", "Games", "Words", "Hangmen", "target_words.json");
        
        Console.WriteLine($"Looking for target words at: {_targetWordsPath}");
        
        LoadWords();
    }

    private void LoadWords()
    {
        try
        {
            if (File.Exists(_targetWordsPath))
            {
                Console.WriteLine("Found target_words.json");
                var json = File.ReadAllText(_targetWordsPath);
                Console.WriteLine($"JSON content: {json}"); // Debug the JSON content
                
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true // Make property name matching case-insensitive
                };
                
                var targetWords = JsonSerializer.Deserialize<TargetWords>(json, options);
                if (targetWords?.Words != null)
                {
                    _targetWords.AddRange(targetWords.Words);
                    Console.WriteLine($"Loaded {_targetWords.Count} target words");
                    Console.WriteLine($"First few words: {string.Join(", ", _targetWords.Take(3))}"); // Debug the loaded words
                }
                else
                {
                    Console.WriteLine("No words found in target_words.json");
                }
            }
            else
            {
                Console.WriteLine($"Target words file not found at {_targetWordsPath}");
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
        [JsonPropertyName("words")]
        public List<string> Words { get; set; } = new();
    }
}