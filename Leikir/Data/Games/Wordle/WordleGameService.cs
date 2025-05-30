using Leikir.Data.Interfaces;
using Leikir.Models.DTO.Game.Wordle;
using Leikir.Models.DTO.Score;
using Leikir.Models;

namespace Leikir.Data.Games.Wordle;

public class WordleGameService : IGameService
{
    private const int MAX_ATTEMPTS = 6;
    private const int WORD_LENGTH = 5;
    private readonly WordleWordValidator _wordValidator;
    private readonly LeikirContext _context;
    private static readonly Dictionary<int, WordleGameStateDto> _activeGames = new();

    public WordleGameService(WordleWordValidator wordValidator, LeikirContext context)
    {
        _wordValidator = wordValidator;
        _context = context;
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

    public async Task<WordleGuessResponseDto> MakeAttemptAsync(int userId, int gameId, string guess)
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
        var targetWord = gameState.TargetWord;

        // Check if game is already over
        if (gameState.IsGameOver)
        {
            throw new InvalidOperationException("Game is already over");
        }

        // Add guess to list
        gameState.Guesses.Add(guess);
        gameState.NumberOfAttempts++;

        // Check if guess is correct
        var isCorrect = guess == targetWord;
        var letterStates = new List<LetterState>();
        var targetWordChars = targetWord.ToCharArray();

        if (isCorrect)
        {
            // All letters are correct
            letterStates.AddRange(Enumerable.Repeat(LetterState.Correct, WORD_LENGTH));
            gameState.IsGameOver = true;
            gameState.IsWon = true;

            // Calculate score based on attempts and time
            var timeInSeconds = (int)(DateTime.UtcNow - gameState.StartedAt).TotalSeconds;
            gameState.Score = CalculateScore(gameState.NumberOfAttempts, timeInSeconds);

            // Save score to database
            await SaveScoreAsync(userId, gameId, gameState.Score);
        }
        else
        {
            // Count occurrences of each letter in the target word
            var letterCounts = new Dictionary<char, int>();
            for (int i = 0; i < targetWordChars.Length; i++)
            {
                var letter = targetWordChars[i];
                if (!letterCounts.ContainsKey(letter))
                {
                    letterCounts[letter] = 0;
                }
                letterCounts[letter]++;
            }

            // First pass: Mark correct letters
            for (int i = 0; i < guess.Length; i++)
            {
                if (guess[i] == targetWordChars[i])
                {
                    letterStates.Add(LetterState.Correct);
                    letterCounts[guess[i]]--; // Decrease count for this letter
                }
                else
                {
                    letterStates.Add(LetterState.Absent); // Temporary state
                }
            }

            // Second pass: Check for present letters
            for (int i = 0; i < guess.Length; i++)
            {
                if (letterStates[i] == LetterState.Correct) continue; // Skip already correct letters

                var letter = guess[i];
                if (letterCounts.ContainsKey(letter) && letterCounts[letter] > 0)
                {
                    letterStates[i] = LetterState.Present;
                    letterCounts[letter]--; // Decrease count for this letter
                }
                else
                {
                    letterStates[i] = LetterState.Absent;
                }
            }

            // Check if game is over (max attempts reached)
            if (gameState.NumberOfAttempts >= MAX_ATTEMPTS)
            {
                gameState.IsGameOver = true;
                gameState.IsWon = false;
            }
        }

        // Create response with letter states for frontend
        return new WordleGuessResponseDto
        {
            Guess = guess,
            LetterStates = letterStates,
            IsCorrect = isCorrect,
            IsGameOver = gameState.IsGameOver,
            IsWon = gameState.IsWon,
            Score = gameState.Score
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

    private int CalculateScore(int attempts, int timeInSeconds)
    {
        int attemptsScore = attempts switch
        {
            1 => 100,
            2 => 80,
            3 => 60,
            4 => 40,
            5 => 30,
            _ => 15
        };

        int timeScore = timeInSeconds switch
        {
            var t when t <= 60 => 100,
            var t when t <= 180 => 80,
            var t when t <= 300 => 60,
            var t when t <= 480 => 40,
            var t when t <= 600 => 30,
            _ => 15
        };
        
        return attemptsScore + timeScore;
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

        // Add score to Scores table
        _context.Scores.Add(scoreEntity);

        // Update user's total score
        var user = await _context.Users.FindAsync(userId);
        if (user != null)
        {
            user.TotalScore += score;
        }

        // Save changes
        await _context.SaveChangesAsync();
    }
}