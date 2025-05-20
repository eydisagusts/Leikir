using System.Text.Json;
using Leikir.Data.Interfaces;

namespace Leikir.Data.Games.Wordle;

public class WordleWordValidator : IWordValidator
{
    private HashSet<string> _validWords;
    private List<string> _targetWords;
    private Random _random;
    private readonly string _validWordsPath;
    private readonly string _targetWordsPath;

    public WordleWordValidator()
    {
        _validWords = new HashSet<string>();
        _targetWords = new List<string>();
        _random = new Random();
        
        // Set paths relative to the application root
        _validWordsPath = Path.Combine("Data", "Games", "Words", "wordle", "valid_words.txt");
        _targetWordsPath = Path.Combine("Data", "Games", "Words", "wordle", "target_words.json");
        
        LoadWords();
    }

    private void LoadWords()
    {
        try
        {
            // Load valid words (dictionary)
            if (File.Exists(_validWordsPath))
            {
                var words = File.ReadAllLines(_validWordsPath);
                foreach (var word in words)
                {
                    if (word.Length == 5) // Only add 5-letter words
                    {
                        _validWords.Add(word.ToUpper());
                    }
                }
            }
            else
            {
                throw new FileNotFoundException($"Valid words file not found at {_validWordsPath}");
            }

            // Load target words
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

    public async Task<bool> IsValidWordAsync(string word)
    {
        return _validWords.Contains(word.ToUpper());
    }

    public async Task<string> GetRandomWordAsync()
    {
        if (_targetWords.Count == 0)
        {
            throw new InvalidOperationException("No target words available");
        }
        return _targetWords[_random.Next(_targetWords.Count)];
    }

    public async Task<string> GetDailyWordAsync()
    {
        // For now, just return a random word
        // TODO: Implement daily word selection based on date
        return await GetRandomWordAsync();
    }

    private class TargetWords
    {
        public List<string> Words { get; set; } = new();
    }
}