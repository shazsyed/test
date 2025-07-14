import type { Challenge } from "../types/challenge"

export const challenges: Challenge[] = [
  {
    "id": "DEMO",
    "title": "How to Play: Demo Challenge",
    "description": "Use it to practice how to view code, check hints, read explanations, and submit answers in this lab environment.",
    "difficulty": "beginner",
    "vulnerableLines": [3],
    "hints": [
      "There is no security bug here—just a Hello World!",
      "Use this challenge to learn how the interface works.",
      "Try submitting any answer to see how submissions are handled."
    ],
    "explanations": {
      3: "Good work"
    },
    "code": "@GetMapping(\"/hello-world\")\npublic ResponseEntity<String> helloWorld() {\n    return ResponseEntity.ok(\"I am vulnerable line!\");\n}",
    labUrl: "https://google.com"
  },  
  // BEGINNER CHALLENGES
  {
    id: "CHALLENGE1",
    title: "Open Door",
    description: "Find the obvious SSRF vulnerability in this API",
    difficulty: "beginner",
    vulnerableLines: [9],
    hints: ["Look for places where user input is passed directly without sanitization"],
    explanations: {
      9: "Using user input to make HTTP request without sanitization will lead to SSRF",
    },
    code: `@GetMapping("/open-door")
    public ResponseEntity<String> fetchUrl(@RequestParam String url) {
        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return ResponseEntity.status(response.statusCode()).body(response.body());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }`,
    labUrl: "http://localhost:8888/open-door?url=here"
  },
  {
    id: "CHALLENGE2",
    title: "Basic Blacklist",
    description: "The server blocks obvious localhost patterns, but its defenses are naive.",
    difficulty: "beginner",
    vulnerableLines: [4],
    hints: [
      "How many ways can you write the same IP address?",
      "Does 'contains' catch everything that resolves to localhost?"
    ],
    explanations: {
      4: "The 'contains' check only blocks exact string matches for 'localhost' and '127.0.0.1'. It fails to detect other numeric notations that resolve to localhost, enabling SSRF."
    },
    code: `@GetMapping("/bypass-basic")
    public ResponseEntity<String> fetchDecimal(@RequestParam String url) {
        // Blacklist approach: block 'localhost' and '127.0.0.1' but allow decimal notation
        if (url.contains("localhost") || url.contains("127.0.0.1")) {
            return ResponseEntity.badRequest().body("Blocked by blacklist: localhost and 127.0.0.1 are not allowed");
        }
        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return ResponseEntity.status(response.statusCode()).body(response.body());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }`,
    labUrl: "http://localhost:8888/bypass-basic?url=here"
  },

  {
    id: "CHALLENGE3",
    title: "Sixth Sense",
    description: "Even with IPv4 blacklisting, IPv6 can be a backdoor.",
    difficulty: "intermediate",
    vulnerableLines: [15],
    hints: [
      "Can loopback still be accessed if formatted in a certain way?",
       "Why is ::1 explicitly allowed?",
       "Notice what addresses are being blocked—and what isn't.",
    ],
    explanations: {
      15: "This logic explicitly permits requests to the IPv6 loopback (::1), allowing attackers to bypass blacklist filters and trigger SSRF to internal services."
    },
    code: `@GetMapping("/sixth-sense")
    public ResponseEntity<String> fetchIpv6(@RequestParam String url) {
        if (
            url.contains("127.0.0.1") ||
            url.contains("localhost") ||
            url.matches(".*\\b(\\d{1,3}\\.){3}\\d{1,3}(:\\d+)?\\b.*") || // IPv4 dotted decimal
            url.matches(".*\\b\\d{7,10}(:\\d+)?\\b.*") // Decimal notation
        ) {
            return ResponseEntity.badRequest().body("Blocked by blacklist: IPv4 addresses and localhost are not allowed");
        }
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if (host == null) {
                return ResponseEntity.badRequest().body("Invalid IPv6 loopback address. Use http://[::1]:PORT/");
            }
            String normalizedHost = host.replace("[", "").replace("]", "");
            if (!normalizedHost.equals("::1") && !normalizedHost.equalsIgnoreCase("0:0:0:0:0:0:0:1")) {
                return ResponseEntity.badRequest().body("Invalid IPv6 loopback address. Use http://[::1]:PORT/");
            }
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(uri)
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return ResponseEntity.status(response.statusCode()).body(response.body());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }`,
    labUrl: "http://localhost:8888/sixth-sense?url=here"
  },
  {
    id: "CHALLENGE4",
    title: "Name Game",
    description: "The server fetches DNS data from a user-supplied URL, but can you trick it into talking to internal systems?",
    difficulty: "intermediate",
    vulnerableLines: [18],
    hints: [
      "Think about the security of DNS lookups.",
      "Check how the server handles the user-provided URL.",
      "Is there any protection against internal IP resolution?"
    ],
    explanations: {
      18: "This lets user input control the final destination after DNS resolution.",
    },
    code: `@GetMapping("/name-game")
public ResponseEntity<String> fetchDns(@RequestParam String url) {
    if (
        url.matches(".*\\b(\\d{1,3}\\.){3}\\d{1,3}(:\\d+)?\\b.*") ||
        url.matches(".*\\b\\d{7,10}(:\\d+)?\\b.*") ||
        url.matches(".*\\[.*:.*:.*\\].*")
    ) {
        return ResponseEntity.badRequest().body("Blocked by blacklist: direct IP addresses are not allowed");
    }
    try {
        URI uri = URI.create(url);
        String host = uri.getHost();
        if (host == null) {
            return ResponseEntity.badRequest().body("Invalid host in URL");
        }
        java.net.InetAddress address = java.net.InetAddress.getByName(host);
        String resolvedIp = address.getHostAddress();
        String newUrl = url.replaceFirst(host, resolvedIp);
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(newUrl))
            .GET()
            .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        return ResponseEntity.status(response.statusCode()).body(response.body() + "\n[Resolved IP: " + resolvedIp + "]");
    } catch (Exception e) {
        return ResponseEntity.badRequest().body("Error: " + e.getMessage());
    }
}`,
    labUrl: "http://localhost:8888/name-game?url=here"
  }
]
