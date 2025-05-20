using Leikir.Data.Interfaces;
using Leikir.Models.DTO.Game.Wordle;
using Leikir.Models.DTO.Score;
using Leikir.Models;

namespace Leikir.Data.Games.Wordle;

public class WordleGameService : IGameService
{
    private readonly WordleWordValidator _wordValidator;
    private readonly LeikirContext _context;
    private readonly Dictionary<int, WordleGameStateDto> _activeGames;

    public WordleGameService(WordleWordValidator wordValidator, LeikirContext context)
    {
        _wordValidator = wordValidator;
        _context = context;
        _activeGames = new Dictionary<int, WordleGameStateDto>();
    }

    public async Task<ScoreDTO> StartNewGameAsync(int userId, int gameId)
    {
        // Check if user exists
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new ArgumentException("User not found");
        }

        // Get a random target word
        var targetWord = await _wordValidator.GetRandomWordAsync();

        // Create new game state
        var gameState = new WordleGameStateDto
        {
            UserId = userId,
            GameId = gameId,
            TargetWord = targetWord,
            Guesses = new List<string>(),
            NumberOfAttempts = 0,
            IsGameOver = false,
            IsWon = false,
            Score = 0,
            StartedAt = DateTime.UtcNow
        };

        // Store game state
        _activeGames[userId] = gameState;

        // Create and return score DTO
        return new ScoreDTO
        {
            UserId = userId,
            GameId = gameId,
            UserScore = 0,
            NumberOfAttempts = 0,
            GuessedWord = targetWord,
            AchivedAt = DateTime.UtcNow
        };
    }

    public async Task<ScoreDTO> GetCurrentGameStateAsync(int userId, int gameId)
    {
        if (_activeGames.TryGetValue(userId, out var gameState))
        {
            return new ScoreDTO
            {
                UserId = userId,
                GameId = gameId,
                UserScore = gameState.Score,
                NumberOfAttempts = gameState.NumberOfAttempts,
                GuessedWord = gameState.TargetWord,
                AchivedAt = gameState.StartedAt
            };
        }
        return null;
    }

    public async Task<ScoreDTO> MakeAttemptAsync(int userId, int gameId, string guess)
    {
        // Get current game state
        if (!_activeGames.TryGetValue(userId, out var gameState))
        {
            throw new InvalidOperationException("No active game found");
        }

        // Validate guess
        if (!await _wordValidator.IsValidWordAsync(guess))
        {
            throw new ArgumentException("Invalid word");
        }

        // Convert to uppercase for consistency
        guess = guess.ToUpper();

        // Check if game is already over
        if (gameState.IsGameOver)
        {
            throw new InvalidOperationException("Game is already over");
        }

        // Add guess to list
        gameState.Guesses.Add(guess);
        gameState.NumberOfAttempts++;

        // Check if guess is correct
        var isCorrect = guess == gameState.TargetWord;
        var letterStates = new List<LetterState>();

        if (isCorrect)
        {
            // All letters are correct
            letterStates.AddRange(Enumerable.Repeat(LetterState.Correct, 5));
            gameState.IsGameOver = true;
            gameState.IsWon = true;
            gameState.Score = CalculateScore(gameState.NumberOfAttempts);
            gameState.CompletedAt = DateTime.UtcNow;

            // Save score to database
            await SaveScoreAsync(userId, gameId, gameState.Score);
        }
        else
        {
            // Check each letter
            for (int i = 0; i < 5; i++)
            {
                if (guess[i] == gameState.TargetWord[i])
                {
                    letterStates.Add(LetterState.Correct);
                }
                else if (gameState.TargetWord.Contains(guess[i]))
                {
                    letterStates.Add(LetterState.Present);
                }
                else
                {
                    letterStates.Add(LetterState.Absent);
                }
            }

            // Check if game is over (max 6 attempts)
            if (gameState.NumberOfAttempts >= 6)
            {
                gameState.IsGameOver = true;
                gameState.IsWon = false;
                gameState.CompletedAt = DateTime.UtcNow;
            }
        }

        // Create response with letter states for frontend
        var response = new WordleGuessResponseDto
        {
            Guess = guess,
            LetterStates = letterStates,
            IsCorrect = isCorrect,
            IsGameOver = gameState.IsGameOver,
            IsWon = gameState.IsWon,
            Score = gameState.Score
        };

        return new ScoreDTO
        {
            UserId = userId,
            GameId = gameId,
            UserScore = gameState.Score,
            NumberOfAttempts = gameState.NumberOfAttempts,
            GuessedWord = gameState.TargetWord,
            AchivedAt = DateTime.UtcNow
        };
    }

    public async Task<string> GetDailyTargetWordAsync()
    {
        return await _wordValidator.GetDailyWordAsync();
    }

    public async Task<string> GetRandomTargetWordAsync()
    {
        return await _wordValidator.GetRandomWordAsync();
    }

    private int CalculateScore(int attempts)
    {
        // Base score is 1000, reduced by 100 for each attempt
        return Math.Max(1000 - (attempts - 1) * 100, 100);
    }

    private async Task SaveScoreAsync(int userId, int gameId, int score)
    {
        var scoreEntity = new Score
        {
            UserId = userId,
            GameId = gameId,
            UserScore = score,
            AchivedAt = DateTime.UtcNow
        };

        _context.Scores.Add(scoreEntity);
        await _context.SaveChangesAsync();
    }
}