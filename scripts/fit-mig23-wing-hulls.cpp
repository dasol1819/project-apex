// Tim Samedov MiG-23MLD source, CC BY 4.0. Preserve the original GLB.
// Reduce the visible swept-wing vertices to an exact XZ convex support hull.
// A rigid Y rotation can then bound every source vertex at any sweep angle.
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
using P = std::array<double, 2>;
struct Wing { V hinge{}; bool hasHinge=false; std::vector<V> vertices; };
double cross(const P& a,const P& b,const P& c) {
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
}
int main(int argc,char** argv) try {
    if(argc!=2) throw std::runtime_error("usage: fit-mig23-wing-hulls source.csv");
    std::ifstream in(argv[1]); if(!in) throw std::runtime_error("source unavailable");
    std::string line; std::getline(in,line);
    if(line!="part,kind,x,y,z") throw std::runtime_error("unexpected source header");
    std::map<int,Wing> wings;
    while(std::getline(in,line)) {
        std::replace(line.begin(),line.end(),',',' ');
        std::istringstream row(line); int part,kind; V p;
        if(!(row>>part>>kind>>p[0]>>p[1]>>p[2])||(part!=1&&part!=2)||(kind!=0&&kind!=1))
            throw std::runtime_error("invalid wing record");
        for(double x:p) if(!std::isfinite(x)) throw std::runtime_error("nonfinite vertex");
        auto& w=wings[part];
        if(kind==1) { if(w.hasHinge) throw std::runtime_error("duplicate hinge"); w.hinge=p; w.hasHinge=true; }
        else w.vertices.push_back(p);
    }
    if(wings.size()!=2) throw std::runtime_error("missing wing");
    std::cout<<std::setprecision(17)<<"{\n  \"sourceSha256\": \"eb1d5b3ea7a370e157b89061ade52eaa4e7536ce927852124e40bde94679d4b8\",\n"
        <<"  \"source\": \"Tim Samedov (citizensnip), CC BY 4.0\",\n"
        <<"  \"referenceSweepDegrees\": 72,\n  \"paddingMetres\": 0.002,\n"
        <<"  \"scope\": \"Visible original moving-wing source only; source-model AABB, not measured aircraft mass centre or triangle-exact collision\",\n  \"parts\": {\n";
    bool first=true;
    for(const auto& [part,w]:wings) {
        if(!w.hasHinge||w.vertices.size()<3) throw std::runtime_error("incomplete source");
        std::vector<P> points; double low=w.vertices[0][1],high=low;
        for(const auto& p:w.vertices) { points.push_back({p[0],p[2]}); low=std::min(low,p[1]); high=std::max(high,p[1]); }
        std::sort(points.begin(),points.end());points.erase(std::unique(points.begin(),points.end()),points.end());
        std::vector<P> hull;
        for(const auto& p:points) { while(hull.size()>1&&cross(hull[hull.size()-2],hull.back(),p)<=0) hull.pop_back(); hull.push_back(p); }
        const auto lower=hull.size();
        for(auto i=points.rbegin()+1;i!=points.rend();++i) { while(hull.size()>lower&&cross(hull[hull.size()-2],hull.back(),*i)<=0) hull.pop_back(); hull.push_back(*i); }
        hull.pop_back(); if(hull.size()<3) throw std::runtime_error("degenerate source hull");
        if(!first)std::cout<<",\n";
        first=false;
        std::cout<<"    \""<<part<<"\": {\"hinge\":["<<w.hinge[0]<<','<<w.hinge[1]<<','<<w.hinge[2]<<"],\"sign\":"<<(part==1?1:-1)
            <<",\"minY\":"<<low<<",\"maxY\":"<<high<<",\"sourceVertices\":"<<w.vertices.size()<<",\"hullXZ\":[";
        bool sep=false;for(const auto& p:hull) {if(sep)std::cout<<',';sep=true;std::cout<<'['<<p[0]<<','<<p[1]<<']';}
        std::cout<<"]}";
    }
    std::cout<<"\n  }\n}\n";return 0;
} catch(const std::exception& e) {std::cerr<<e.what()<<'\n';return 1;}
