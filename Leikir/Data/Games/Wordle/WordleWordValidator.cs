using System.Text.Json;
using Leikir.Data.Interfaces;
using System.Text.Json.Serialization;

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
        
        // Get the application's base directory
        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        
        // Set paths relative to the application root
        _validWordsPath = Path.Combine(baseDir, "Data", "Games", "Words", "Wordle", "valid_words.txt");
        _targetWordsPath = Path.Combine(baseDir, "Data", "Games", "Words", "Wordle", "target_words.json");
        
        Console.WriteLine($"Looking for valid words at: {_validWordsPath}");
        Console.WriteLine($"Looking for target words at: {_targetWordsPath}");
        
        LoadWords();
    }

    private void LoadWords()
    {
        try
        {
            // Load valid words (dictionary)
            if (File.Exists(_validWordsPath))
            {
                Console.WriteLine("Found valid_words.txt");
                var words = File.ReadAllLines(_validWordsPath);
                Console.WriteLine($"Total words in file: {words.Length}");
                
                int fiveLetterWords = 0;
                int otherLengthWords = 0;
                
                foreach (var word in words)
                {
                    if (word.Length == 5) // Only add 5-letter words
                    {
                        _validWords.Add(word.ToUpper());
                        fiveLetterWords++;
                    }
                    else
                    {
                        otherLengthWords++;
                    }
                }
                
                Console.WriteLine($"Words loaded: {_validWords.Count}");
                Console.WriteLine($"Five-letter words: {fiveLetterWords}");
                Console.WriteLine($"Other length words: {otherLengthWords}");
                
                // Print some sample words
                Console.WriteLine("Sample valid words:");
                foreach (var word in _validWords.Take(5))
                {
                    Console.WriteLine($"- {word}");
                }
            }
            else
            {
                Console.WriteLine($"Valid words file not found at {_validWordsPath}");
                throw new FileNotFoundException($"Valid words file not found at {_validWordsPath}");
            }

            // Load target words
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
        [JsonPropertyName("words")]
        public List<string> Words { get; set; } = new();
    }
}