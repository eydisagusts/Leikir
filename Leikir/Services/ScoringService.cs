namespace Leikir.Services;

public class ScoringService
{
    public int CalculateScore(int attempts, int timeInSeconds)
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
        
        return (attemptsScore + timeScore) / 2;
    }

    public int CalculateHangmanScore(int wrongLetters, int timeInSeconds)
    {
        int wrongLettersScore = wrongLetters switch
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
        
        return (wrongLettersScore + timeScore) / 2;
    }
}