using System.Threading.Tasks;
using Leikir.Models.DTO.Score;
using Leikir.Models.DTO.Game.Wordle;

namespace Leikir.Data.Interfaces;

public interface IGameService
{
    // Start a new game
    Task<ScoreDTO> StartNewGameAsync(int userId, int gameId);
    
    // Get current game state
    Task<ScoreDTO> GetCurrentGameStateAsync(int userId, int gameId);
    
    // Make a guess/attempt
    Task<WordleGuessResponseDto> MakeAttemptAsync(int userId, int gameId, string attempt);
    
    // Get daily target word (for Wordle)
    Task<string> GetDailyTargetWordAsync();
    
    // Get random target word (for new games)
    Task<string> GetRandomTargetWordAsync();
} 