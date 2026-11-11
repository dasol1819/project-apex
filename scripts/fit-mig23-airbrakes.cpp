// Rigid registration of Tim Samedov's CC BY 4.0 MiG-23MLD airbrake skins.
// Input CSV: panel, source XYZ, matching fuselage XYZ, in normalized metres.
// Horn's quaternion fit; the 4x4 symmetric eigenproblem uses Jacobi rotations.
// This fits authored geometry, not measurements of a physical aircraft.
#include <algorithm>
#include <array>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

using V = std::array<double, 3>;
using M = std::array<std::array<double, 4>, 4>;
struct Pair { V source{}, target{}; };

static V transform(const std::array<double, 4>& q, const V& p) {
    const auto [w,x,y,z] = q;
    return {
        (1-2*y*y-2*z*z)*p[0] + (2*x*y-2*w*z)*p[1] + (2*x*z+2*w*y)*p[2],
        (2*x*y+2*w*z)*p[0] + (1-2*x*x-2*z*z)*p[1] + (2*y*z-2*w*x)*p[2],
        (2*x*z-2*w*y)*p[0] + (2*y*z+2*w*x)*p[1] + (1-2*x*x-2*y*y)*p[2]
    };
}

static std::array<double, 4> largestEigenvector(M a) {
    M v{};
    for (int i=0; i<4; ++i) v[i][i]=1;
    for (int iteration=0; iteration<100; ++iteration) {
        int p=0, q=1;
        for (int i=0; i<4; ++i) for (int j=i+1; j<4; ++j)
            if (std::abs(a[i][j])>std::abs(a[p][q])) { p=i; q=j; }
        if (std::abs(a[p][q])<1e-16) break;
        const double tau=(a[q][q]-a[p][p])/(2*a[p][q]);
        const double t=std::copysign(1.0,tau)/(std::abs(tau)+std::sqrt(1+tau*tau));
        const double c=1/std::sqrt(1+t*t), s=t*c, off=a[p][q];
        a[p][p]-=t*off; a[q][q]+=t*off; a[p][q]=a[q][p]=0;
        for (int k=0; k<4; ++k) {
            if (k!=p && k!=q) {
                const double u=a[k][p], w=a[k][q];
                a[k][p]=a[p][k]=c*u-s*w;
                a[k][q]=a[q][k]=s*u+c*w;
            }
            const double u=v[k][p], w=v[k][q];
            v[k][p]=c*u-s*w; v[k][q]=s*u+c*w;
        }
    }
    int index=0;
    for (int i=1; i<4; ++i) if (a[i][i]>a[index][index]) index=i;
    std::array<double,4> result{};
    double length=0;
    for (int i=0; i<4; ++i) { result[i]=v[i][index]; length+=result[i]*result[i]; }
    length=std::sqrt(length)*(result[0]<0?-1:1);
    for (auto& value:result) value/=length;
    return result;
}

static void fit(const std::string& name, const std::vector<Pair>& pairs) {
    if (pairs.size()<3) throw std::runtime_error("At least three matching points required");
    V source{}, target{};
    for (const auto& p:pairs) for (int k=0; k<3; ++k) {
        source[k]+=p.source[k]/pairs.size(); target[k]+=p.target[k]/pairs.size();
    }
    double s[3][3]{};
    for (const auto& p:pairs) for (int i=0; i<3; ++i) for (int j=0; j<3; ++j)
        s[i][j]+=(p.source[i]-source[i])*(p.target[j]-target[j]);
    const double trace=s[0][0]+s[1][1]+s[2][2];
    M n{{
        {trace,s[1][2]-s[2][1],s[2][0]-s[0][2],s[0][1]-s[1][0]},
        {s[1][2]-s[2][1],s[0][0]-s[1][1]-s[2][2],s[0][1]+s[1][0],s[0][2]+s[2][0]},
        {s[2][0]-s[0][2],s[0][1]+s[1][0],-s[0][0]+s[1][1]-s[2][2],s[1][2]+s[2][1]},
        {s[0][1]-s[1][0],s[0][2]+s[2][0],s[1][2]+s[2][1],-s[0][0]-s[1][1]+s[2][2]}
    }};
    const auto q=largestEigenvector(n);
    const V rotated=transform(q,source);
    V translation{};
    for (int k=0; k<3; ++k) translation[k]=target[k]-rotated[k];
    const double sine=std::hypot(q[1],q[2],q[3]);
    double squaredError=0, maximum=0;
    for (const auto& p:pairs) {
        const auto r=transform(q,p.source);
        double error=0;
        for (int k=0; k<3; ++k) error+=std::pow(r[k]+translation[k]-p.target[k],2);
        squaredError+=error; maximum=std::max(maximum,std::sqrt(error));
    }
    std::cout << "  \"" << name << "\": {\"pairs\":" << pairs.size()
        << ",\"axis\":[" << (sine>1e-12?q[1]/sine:1) << ','
        << (sine>1e-12?q[2]/sine:0) << ',' << (sine>1e-12?q[3]/sine:0)
        << "],\"degrees\":" << 2*std::atan2(sine,q[0])*180/std::acos(-1.0)
        << ",\"translation\":[" << translation[0] << ',' << translation[1] << ',' << translation[2]
        << "],\"quaternionWXYZ\":[" << q[0] << ',' << q[1] << ',' << q[2] << ',' << q[3]
        << "],\"rmsMetres\":" << std::sqrt(squaredError/pairs.size())
        << ",\"maxMetres\":" << maximum << '}';
}

int main(int argc, char** argv) {
    try {
        if (argc!=2) throw std::runtime_error("usage: fit-mig23-airbrakes airbrake-landmarks.csv");
        std::ifstream input(argv[1]);
        if (!input) throw std::runtime_error("Cannot open landmarks CSV");
        std::map<std::string,std::vector<Pair>> groups;
        std::string line;
        while (std::getline(input,line)) {
            if (line.empty() || line[0]=='#') continue;
            for (auto& c:line) if (c==',') c=' ';
            std::istringstream row(line);
            std::string name; Pair pair;
            if (!(row>>name>>pair.source[0]>>pair.source[1]>>pair.source[2]
                    >>pair.target[0]>>pair.target[1]>>pair.target[2]))
                throw std::runtime_error("Malformed landmarks row");
            groups[name].push_back(pair);
        }
        if (groups.empty()) throw std::runtime_error("No landmarks found");
        std::cout << std::setprecision(13) << "{\n";
        bool first=true;
        for (const auto& [name,pairs]:groups) { if (!first) std::cout << ",\n"; first=false; fit(name,pairs); }
        std::cout << "\n}\n";
    } catch (const std::exception& e) { std::cerr<<e.what()<<'\n'; return 1; }
}
