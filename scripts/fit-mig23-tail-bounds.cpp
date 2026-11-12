// Fit body-axis collision/wreckage boxes to the actual gameplay tail rig.
// Input: ordered source vertices at -0.6, 0, +0.6 radians, in aircraft metres.
// Every rigidly rotating coordinate is A*cos(t)+B*sin(t)+C. Evaluate its
// stationary points as well as both stops to enclose the continuous arc.
#include <array>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

using V = std::array<double, 3>;
constexpr double stop = .6, padding = .002;
struct Samples { std::array<std::vector<V>, 3> pose; };

int main(int argc, char** argv) try {
    if (argc != 2) throw std::runtime_error("usage: fit-mig23-tail-bounds vertices.csv");
    std::ifstream input(argv[1]);
    if (!input) throw std::runtime_error("cannot open source vertices");
    std::string line;
    std::getline(input, line);
    if (line != "part,angle,x,y,z") throw std::runtime_error("unexpected CSV header");
    std::map<int, Samples> samples;
    while (std::getline(input, line)) {
        if (line.empty()) continue;
        for (char& c : line) if (c == ',') c = ' ';
        std::istringstream row(line);
        int part; double angle; V v;
        if (!(row >> part >> angle >> v[0] >> v[1] >> v[2])) throw std::runtime_error("bad CSV row");
        if (part != 3 && part != 4 && part != 20) throw std::runtime_error("unexpected native part");
        for (double x : v) if (!std::isfinite(x)) throw std::runtime_error("nonfinite source vertex");
        const int pose = std::abs(angle + stop) < 1e-12 ? 0 : std::abs(angle) < 1e-12 ? 1 : std::abs(angle - stop) < 1e-12 ? 2 : -1;
        if (pose < 0) throw std::runtime_error("unexpected actuator sample");
        samples[part].pose[pose].push_back(v);
    }
    if (samples.size() != 3) throw std::runtime_error("missing tail surface");
    std::cout << std::setprecision(14) << "{\n"
        "  \"source\": \"Tim Samedov (citizensnip), MiG-23MLD, CC BY 4.0\",\n"
        "  \"sourceSha256\": \"eb1d5b3ea7a370e157b89061ade52eaa4e7536ce927852124e40bde94679d4b8\",\n"
        "  \"space\": \"aircraft-local metres after gameplay normalization and gear contact fit\",\n"
        "  \"limitNote\": \"visual rig clamp, not verified aircraft hydraulic stops\",\n"
        "  \"angleLimitRadians\": 0.6,\n  \"paddingMetres\": 0.002,\n  \"parts\": {\n";
    bool first = true;
    for (const auto& [part, s] : samples) {
        const auto n = s.pose[1].size();
        if (!n || n != s.pose[0].size() || n != s.pose[2].size()) throw std::runtime_error("unpaired source vertices");
        V lo, hi, arcLo, arcHi;
        lo.fill(std::numeric_limits<double>::infinity()); arcLo = lo;
        hi.fill(-std::numeric_limits<double>::infinity()); arcHi = hi;
        for (std::size_t i = 0; i < n; ++i) for (int k = 0; k < 3; ++k) {
            const double zero = s.pose[1][i][k], minus = s.pose[0][i][k], plus = s.pose[2][i][k];
            lo[k] = std::min(lo[k], zero); hi[k] = std::max(hi[k], zero);
            const double a = (zero - (plus + minus) * .5) / (1 - std::cos(stop));
            const double b = (plus - minus) / (2 * std::sin(stop)), c = zero - a;
            auto sample = [&](double t) {
                const double x = a * std::cos(t) + b * std::sin(t) + c;
                arcLo[k] = std::min(arcLo[k], x); arcHi[k] = std::max(arcHi[k], x);
            };
            sample(-stop); sample(0); sample(stop);
            const double critical = std::atan2(b, a), pi = std::acos(-1.0);
            for (int turn = -2; turn <= 2; ++turn) {
                const double t = critical + turn * pi;
                if (t >= -stop && t <= stop) sample(t);
            }
        }
        V pivot, half, neutral;
        for (int k = 0; k < 3; ++k) {
            pivot[k] = (lo[k] + hi[k]) * .5;
            neutral[k] = (hi[k] - lo[k]) * .5;
            half[k] = std::max(pivot[k] - arcLo[k], arcHi[k] - pivot[k]) + padding;
        }
        auto vector = [](const V& v) { std::cout << '[' << v[0] << ',' << v[1] << ',' << v[2] << ']'; };
        if (!first) std::cout << ",\n";
        first = false;
        std::cout << "    \"" << part << "\": {\"pivot\":"; vector(pivot);
        std::cout << ",\"half\":"; vector(half);
        std::cout << ",\"neutralHalf\":"; vector(neutral);
        std::cout << ",\"vertices\":" << n << '}';
    }
    std::cout << "\n  }\n}\n";
    return 0;
} catch (const std::exception& e) {
    std::cerr << e.what() << '\n';
    return 1;
}
