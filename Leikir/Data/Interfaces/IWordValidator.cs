using System.Threading.Tasks;

namespace Leikir.Data.Interfaces;

public interface IWordValidator
{
    // Check if a word is valid (exists in the dictionary)
    Task<bool> IsValidWordAsync(string word);
    
    // Get a random valid word
    Task<string> GetRandomWordAsync();
    
    // Get the daily word
    Task<string> GetDailyWordAsync();
}